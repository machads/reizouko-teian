const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 認証チェック関数
function requireAuth(req) {
    const cookies = req.headers.cookie || '';
    return cookies.includes('authenticated=true');
}

// 入力サニタイゼーション
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[<>]/g, '') // XSS対策
        .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z0-9\s,、。！？]/g, '') // 許可文字のみ
        .trim()
        .slice(0, 500); // 長さ制限
}

function createRecipePrompt(ingredients, requiredSeasoning, moodRequest) {
    const ingredientsList = ingredients.join('、');
    const seasoningText = requiredSeasoning ? `\n使いたい調味料: ${requiredSeasoning}` : '';
    const moodText = moodRequest ? `\n気分・要望: ${moodRequest}` : '';
    
    return `食材: ${ingredientsList}${seasoningText}${moodText}
一般的な家庭の調味料（醤油、塩、砂糖、酒、みりん、酢、油等）は使用可能です。

上記の食材を使って、和風・洋風・中華料理を1つずつ提案してください。
${moodRequest ? `\n※ 気分・要望を考慮してレシピを提案してください。` : ''}

各料理について以下の形式で厳密に回答してください：

【和風料理】
【料理名】○○○○
【調理時間】○分
【材料（2人分）】
・食材名：分量
・調味料名：分量
【作り方】
1. ○○○○
2. ○○○○
3. ○○○○
【ポイント】○○○○

【洋風料理】
【料理名】○○○○
【調理時間】○分
【材料（2人分）】
・食材名：分量
・調味料名：分量
【作り方】
1. ○○○○
2. ○○○○
3. ○○○○
【ポイント】○○○○

【中華料理】
【料理名】○○○○
【調理時間】○分
【材料（2人分）】
・食材名：分量
・調味料名：分量
【作り方】
1. ○○○○
2. ○○○○
3. ○○○○
【ポイント】○○○○

【追加食材提案】
※ 以下の食材を追加すると、こんな料理も作れます：
・追加食材名：作れる料理名（簡単な説明）
・追加食材名：作れる料理名（簡単な説明）
・追加食材名：作れる料理名（簡単な説明）`;
}

function parseRecipes(aiResponse) {
    const recipes = {
        japanese: '',
        western: '',
        chinese: ''
    };
    
    try {
        const sections = aiResponse.split(/【(?:和風料理|洋風料理|中華料理)】/);
        
        if (sections.length >= 4) {
            recipes.japanese = sections[1]?.trim() || '';
            recipes.western = sections[2]?.trim() || '';
            recipes.chinese = sections[3]?.trim() || '';
        } else {
            const japaneseMatch = aiResponse.match(/【和風料理】([\s\S]*?)(?=【洋風料理】|$)/);
            const westernMatch = aiResponse.match(/【洋風料理】([\s\S]*?)(?=【中華料理】|$)/);
            const chineseMatch = aiResponse.match(/【中華料理】([\s\S]*?)$/);
            
            recipes.japanese = japaneseMatch ? japaneseMatch[1].trim() : '';
            recipes.western = westernMatch ? westernMatch[1].trim() : '';
            recipes.chinese = chineseMatch ? chineseMatch[1].trim() : '';
        }
        
        if (!recipes.japanese && !recipes.western && !recipes.chinese) {
            throw new Error('レシピの解析に失敗しました');
        }
        
    } catch (error) {
        console.error('Recipe parsing error:', error);
        throw new Error('AIからの応答を解析できませんでした');
    }
    
    return recipes;
}

export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', 'https://reizouko-teian.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // 認証チェック
    if (!requireAuth(req)) {
        return res.status(401).json({
            error: true,
            message: '認証が必要です',
            requireAuth: true
        });
    }

    try {
        const { ingredients, requiredSeasoning, moodRequest } = req.body;
        
        // バリデーション
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({
                error: true,
                message: '食材を入力してください'
            });
        }

        if (ingredients.length > 20) {
            return res.status(400).json({
                error: true,
                message: '食材は20個以下で入力してください'
            });
        }

        // サニタイゼーション
        const sanitizedIngredients = ingredients.map(item => sanitizeInput(item)).filter(item => item);
        const sanitizedSeasoning = requiredSeasoning ? sanitizeInput(requiredSeasoning) : '';
        const sanitizedMood = moodRequest ? sanitizeInput(moodRequest) : '';
        
        console.log('Recipe request received:', { 
            ingredients: sanitizedIngredients, 
            requiredSeasoning: sanitizedSeasoning, 
            moodRequest: sanitizedMood 
        });
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: true,
                message: 'OpenAI APIキーが設定されていません。'
            });
        }
        
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        
        const prompt = createRecipePrompt(sanitizedIngredients, sanitizedSeasoning, sanitizedMood);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "あなたは経験豊富な料理家です。指定された食材を使って、和風・洋風・中華の3つのレシピを提案してください。レシピは家庭でも作りやすく、指定された形式に従って回答してください。"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
        });
        
        const aiResponse = completion.choices[0]?.message?.content;
        
        if (!aiResponse) {
            throw new Error('AIからの応答が空です');
        }
        
        console.log('AI Response received, length:', aiResponse.length);
        
        const recipes = parseRecipes(aiResponse);
        
        // Supabaseに保存（オプション）
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            try {
                const supabase = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_ANON_KEY
                );
                
                await supabase
                    .from('recipe_suggestions')
                    .insert([
                        {
                            ingredients: sanitizedIngredients,
                            required_seasoning: sanitizedSeasoning || null,
                            mood_request: sanitizedMood || null,
                            japanese_recipe: recipes.japanese,
                            western_recipe: recipes.western,
                            chinese_recipe: recipes.chinese
                        }
                    ]);
            } catch (supabaseError) {
                console.error('Supabase save error:', supabaseError);
                // Supabaseエラーは無視してレシピは返す
            }
        }
        
        res.json(recipes);
        
    } catch (error) {
        console.error('Recipe suggestion error:', error);
        
        let errorMessage = '予期しないエラーが発生しました。';
        let statusCode = 500;
        
        if (error.message.includes('API key')) {
            errorMessage = 'OpenAI APIの認証に失敗しました。APIキーを確認してください。';
            statusCode = 401;
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
            errorMessage = 'OpenAI APIの利用制限に達しました。';
            statusCode = 429;
        } else if (error.message.includes('解析')) {
            errorMessage = 'レシピの生成に失敗しました。もう一度お試しください。';
            statusCode = 422;
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'OpenAI APIに接続できませんでした。インターネット接続を確認してください。';
            statusCode = 503;
        }
        
        res.status(statusCode).json({
            error: true,
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}