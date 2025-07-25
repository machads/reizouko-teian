const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 認証チェック関数
function requireAuth(req) {
    const cookies = req.headers.cookie || '';
    console.log('Auth check - cookies:', cookies);
    
    const hasAuth = cookies.includes('authenticated=true');
    const hasSession = cookies.includes('sessionToken=');
    
    console.log('Auth check result:', { hasAuth, hasSession });
    return hasAuth && hasSession;
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

function createRecipePrompt(ingredients, requiredSeasoning, moodRequest, selectedGenre = 'japanese') {
    const ingredientsList = ingredients.join('、');
    const seasoningText = requiredSeasoning ? `\n使いたい調味料: ${requiredSeasoning}` : '';
    const moodText = moodRequest ? `\n要望: ${moodRequest}` : '';
    
    // ジャンルに応じたレシピ名を決定
    const genreMap = {
        'japanese': '和風料理',
        'western': '洋風料理', 
        'chinese': '中華料理'
    };
    
    const recipeName = genreMap[selectedGenre] || '和風料理';
    
    return `食材: ${ingredientsList}${seasoningText}${moodText}

以下の形式で${recipeName}のレシピを詳細に提案してください：

【${recipeName}】
【料理名】○○
【調理時間】準備○分 + 調理○分 = 合計○分
【材料（2人分）】
・メイン食材：○○g（具体的な部位や種類）
・副材料：○○個（切り方も記載）
・調味料：具体的な分量（大さじ○、小さじ○など）
【詳細な作り方】
1. 【下準備】食材の洗い方、切り方、下処理を具体的に（例：玉ねぎは繊維に沿って5mm幅に切る）
2. 【準備工程】調味料の合わせ方、火の準備など
3. 【調理開始】最初の加熱手順（火加減、時間、見た目の変化）
4. 【中盤】味付けのタイミングと手順（入れる順番、混ぜ方）
5. 【仕上げ】完成の見極めポイントと最終調整
【料理のポイント】
・失敗しないコツ：具体的な注意点と対処法
・美味しくするコツ：プロの技術や科学的根拠
・時短のコツ：効率的な手順や準備方法

【さらに美味しくする食材提案】
現在の食材に以下を追加すると、より豊かな味わいになります：
・○○を追加 → ○○の効果で味に深みが増します
・○○を追加 → 食感のアクセントと栄養価アップ
・○○を追加 → 彩りと香りで食欲をそそります`;
}

function parseRecipes(aiResponse, selectedGenre = 'japanese') {
    try {
        console.log('AI Response length:', aiResponse.length);
        console.log('AI Response preview:', aiResponse.substring(0, 500) + '...');
        console.log('Selected genre:', selectedGenre);
        
        // ジャンルに応じたレシピパターンを作成
        const genreMap = {
            'japanese': '和風料理',
            'western': '洋風料理', 
            'chinese': '中華料理'
        };
        
        const recipeName = genreMap[selectedGenre] || '和風料理';
        
        // 選択されたジャンルのレシピを抽出
        const recipePattern = new RegExp(`【${recipeName}】([\\s\\S]*?)(?=【(?:さらに美味しくする食材提案|$))`);
        const recipeMatch = aiResponse.match(recipePattern);
        
        if (!recipeMatch) {
            console.error('No recipe found in response for genre:', selectedGenre);
            throw new Error('レシピの解析に失敗しました');
        }
        
        const recipe = recipeMatch[1].trim();
        
        console.log('Parsed recipe:', {
            genre: selectedGenre,
            hasRecipe: !!recipe,
            recipeLength: recipe.length
        });
        
        // 単一のレシピを返す（従来の形式と互換性を保つため）
        const result = {
            japanese: '',
            western: '',
            chinese: ''
        };
        
        result[selectedGenre] = recipe;
        
        return result;
        
    } catch (error) {
        console.error('Recipe parsing error:', error);
        throw new Error('AIからの応答を解析できませんでした');
    }
}

module.exports = async function handler(req, res) {
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
        const { ingredients, requiredSeasoning, moodRequest, selectedGenre } = req.body;
        
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
            moodRequest: sanitizedMood,
            selectedGenre: selectedGenre 
        });
        
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY environment variable not found');
            return res.status(500).json({
                error: true,
                message: 'OpenAI APIキーが設定されていません。'
            });
        }
        
        console.log('OPENAI_API_KEY found:', !!process.env.OPENAI_API_KEY);
        console.log('API Key prefix:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
        
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 40000, // 40秒タイムアウト
        });
        
        const prompt = createRecipePrompt(sanitizedIngredients, sanitizedSeasoning, sanitizedMood, selectedGenre);
        
        console.log('Calling OpenAI API...');
        console.log('Prompt length:', prompt.length);
        
        let completion;
        try {
            completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `あなたは15年の経験を持つプロの料理人です。指定食材で選択されたジャンルのレシピを詳細に提案してください。ステップバイステップで分かりやすく、実用的なコツも含めてください。指定された形式で回答してください。`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 2500,
            temperature: 0.7,
            stream: false
        });
        console.log('OpenAI API call successful');
        } catch (openaiError) {
            console.error('OpenAI API specific error:', {
                message: openaiError.message,
                status: openaiError.status,
                type: openaiError.type,
                code: openaiError.code,
                cause: openaiError.cause
            });
            throw openaiError;
        }
        
        const aiResponse = completion.choices[0]?.message?.content;
        
        if (!aiResponse) {
            throw new Error('AIからの応答が空です');
        }
        
        console.log('AI Response received, length:', aiResponse.length);
        
        const recipes = parseRecipes(aiResponse, selectedGenre);
        
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
        console.error('Error details:', {
            message: error.message,
            status: error.status,
            type: error.type,
            code: error.code,
            stack: error.stack
        });
        
        let errorMessage = '予期しないエラーが発生しました。';
        let statusCode = 500;
        
        if (error.status === 401 || error.message.includes('API key') || error.message.includes('Incorrect API key')) {
            errorMessage = 'OpenAI APIの認証に失敗しました。APIキーを確認してください。';
            statusCode = 401;
        } else if (error.status === 429 || error.message.includes('quota') || error.message.includes('billing') || error.message.includes('rate limit')) {
            errorMessage = 'OpenAI APIの利用制限に達しました。';
            statusCode = 429;
        } else if (error.message.includes('解析')) {
            errorMessage = 'レシピの生成に失敗しました。もう一度お試しください。';
            statusCode = 422;
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || 
                   error.message.includes('Connection error') || error.message.includes('network') || 
                   error.message.includes('timeout') || error.cause?.code === 'ENOTFOUND') {
            errorMessage = 'OpenAI APIとの接続に問題があります。しばらく待ってから再試行してください。';
            statusCode = 503;
        } else if (error.status === 500 || error.status >= 500) {
            errorMessage = 'OpenAI APIサーバーに問題があります。しばらく待ってから再試行してください。';
            statusCode = 502;
        }
        
        res.status(statusCode).json({
            error: true,
            message: errorMessage,
            details: error.message,
            errorType: error.type || 'unknown',
            errorStatus: error.status || 'unknown'
        });
    }
}