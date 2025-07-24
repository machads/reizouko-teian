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

function createRecipePrompt(ingredients, requiredSeasoning, moodRequest) {
    const ingredientsList = ingredients.join('、');
    const seasoningText = requiredSeasoning ? `\n使いたい調味料: ${requiredSeasoning}` : '';
    const moodText = moodRequest ? `\n気分・要望: ${moodRequest}` : '';
    
    return `# プロの料理人として創意工夫のあるレシピを提案してください

食材: ${ingredientsList}${seasoningText}${moodText}

## 指示
あなたは経験豊富なプロの料理人です。上記の食材を活用して、以下の条件に従って創意工夫のあるレシピを提案してください：

### 重要な条件
1. **独創性**: ありきたりではなく、少し工夫を加えた創造的な料理を考案
2. **具体性**: 火加減、温度、時間を詳細に記載
3. **プロの技術**: 食材の扱い方、下処理のコツ、調理の科学的根拠を含める
4. **実用性**: 家庭でも作れる範囲で、特別な技術を要求しない
5. **美味しさ**: 食材の旨味を最大限に引き出す調理法を採用
${moodRequest ? `6. **要望対応**: 「${moodRequest}」この要望を必ず考慮に入れる` : ''}

### 利用可能な調味料・調理器具
- 基本調味料: 醤油、味噌、塩、砂糖、みりん、酒、酢、油類
- 香辛料: にんにく、生姜、胡椒、唐辛子、各種ハーブ・スパイス
- 調理器具: フライパン、鍋、オーブン、グリル、蒸し器など家庭の一般的な器具

## 回答形式（以下の形式で厳密に回答）

【和風料理】
【料理名】創意工夫のある料理名
【調理時間】準備○分 + 調理○分 = 合計○分
【材料（2人分）】
・メイン食材：○○g（下処理方法も記載）
・副食材：○○個（○○cm角切り）
・調味料A：大さじ○（○○の効果）
・調味料B：小さじ○（○○のために使用）
【詳細な作り方】
1. 【下準備】○○を●●のように処理する（理由：○○のため）。○○は△△度で◇分間○○する
2. 【加熱開始】○○を○○度の○○で○分間○○する。この時○○に注意し、○○の状態になるまで
3. 【調味】○○を加えて○○火で○分煮る。○○が○○したら○○を入れる
4. 【仕上げ】○○度で○分間○○し、最後に○○で香りを立てる
5. 【盛り付け】○○に盛り、○○を添えて完成
【プロのコツ・ポイント】
・○○する際は○○することで○○の効果が得られる
・○○の見極めは○○で判断する
・○○することで○○が向上し、○○な味わいになる

【洋風料理】
【料理名】創意工夫のある料理名
【調理時間】準備○分 + 調理○分 = 合計○分
【材料（2人分）】
・メイン食材：○○g（部位・切り方を指定）
・副食材：○○個（大きさ・形を具体的に）
・調味料・ソース：具体的な分量と効果
【詳細な作り方】
1. 【下準備】具体的な前処理（温度・時間・理由を記載）
2. 【調理開始】詳細な調理手順（火加減・温度・時間）
3. 【味付け】調味のタイミングと理由
4. 【仕上げ】最終的な調整と盛り付け
【プロのコツ・ポイント】
・調理科学に基づいた具体的なアドバイス

【中華料理】
【料理名】創意工夫のある料理名
【調理時間】準備○分 + 調理○分 = 合計○分
【材料（2人分）】
・具体的な材料と分量（切り方・下処理込み）
【詳細な作り方】
1. 【下準備】中華料理特有の下処理方法
2. 【火通し】中華の火力を活かした調理法
3. 【調味】中華調味料の使い方と順序
4. 【仕上げ】中華料理らしい仕上げ方
【プロのコツ・ポイント】
・中華料理の特徴を活かした具体的テクニック

【食材活用度アップ提案】
現在の食材に以下を追加することで、さらに美味しい料理が作れます：
・○○を追加 → ○○料理（具体的な効果・味の変化）
・○○を追加 → ○○料理（栄養価・食感の向上）
・○○を追加 → ○○料理（季節感・彩りの演出）`;
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
            timeout: 30000, // 30秒タイムアウト
        });
        
        const prompt = createRecipePrompt(sanitizedIngredients, sanitizedSeasoning, sanitizedMood);
        
        console.log('Calling OpenAI API...');
        console.log('Prompt length:', prompt.length);
        
        let completion;
        try {
            completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `あなたは15年の経験を持つプロの料理人です。以下の特徴を持っています：

• 創意工夫のある独創的なレシピを考案することが得意
• 調理科学に基づいた具体的で詳細な説明ができる
• 家庭でも実践可能な実用的なアドバイスを提供
• 食材の特性を深く理解し、最大限に活用する方法を知っている
• 火加減、温度、時間などの技術的な詳細を正確に伝えられる

指定された食材を使って、ありきたりではない創意工夫のあるレシピを提案してください。
各工程は詳細に説明し、プロならではのコツとポイントを含めてください。
形式を厳密に守って、読みやすく実用的なレシピを作成してください。`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 4500,
            temperature: 0.8
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