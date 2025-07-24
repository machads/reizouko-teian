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

// サンプルレシピデータ
function generateSampleRecipes(ingredients) {
    const ingredientsList = ingredients.join('、');
    
    return {
        japanese: `【料理名】${ingredientsList}の和風炒め
【調理時間】15分
【材料（2人分）】
・${ingredientsList}：適量
・醤油：大さじ2
・みりん：大さじ1
・ごま油：大さじ1
【作り方】
1. 食材を適当な大きさに切る
2. フライパンにごま油を熱し、食材を炒める
3. 醤油とみりんで味付けをする
【ポイント】強火でさっと炒めることで食材の食感を生かす`,

        western: `【料理名】${ingredientsList}のオイスター炒め
【調理時間】20分
【材料（2人分）】
・${ingredientsList}：適量
・オリーブオイル：大さじ2
・塩：少々
・胡椒：少々
・バター：10g
【作り方】
1. 食材を食べやすい大きさに切る
2. オリーブオイルで食材を炒める
3. 塩胡椒で味付けし、最後にバターを加える
【ポイント】バターを最後に加えることで風味豊かに仕上がる`,

        chinese: `【料理名】${ingredientsList}の中華炒め
【調理時間】15分
【材料（2人分）】
・${ingredientsList}：適量
・ごま油：大さじ1
・醤油：大さじ1
・オイスターソース：大さじ1
・にんにく：1片
【作り方】
1. 食材とにんにくを切る
2. ごま油でにんにくを炒め香りを出す
3. 食材を加えて炒め、調味料で味付けする
【ポイント】高温でさっと炒めることで中華らしい仕上がりに`
    };
}

module.exports = async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    console.log('Suggest recipes API called:', req.method);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        console.log('Method not allowed:', req.method);
        return res.status(405).json({ error: true, message: `Method ${req.method} not allowed` });
    }

    // 認証チェック
    if (!requireAuth(req)) {
        console.log('Authentication failed');
        return res.status(401).json({
            error: true,
            message: '認証が必要です',
            requireAuth: true
        });
    }

    try {
        console.log('Request body:', req.body);
        const { ingredients, requiredSeasoning, moodRequest } = req.body;
        
        // バリデーション
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            console.log('Invalid ingredients:', ingredients);
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
        
        console.log('Generating recipes for ingredients:', sanitizedIngredients);
        
        // OpenAI APIの代わりにサンプルレシピを生成
        const recipes = generateSampleRecipes(sanitizedIngredients);
        
        console.log('Generated recipes successfully');
        
        res.json(recipes);
        
    } catch (error) {
        console.error('Recipe suggestion error:', error);
        
        res.status(500).json({
            error: true,
            message: 'レシピの生成中にエラーが発生しました。もう一度お試しください。',
            details: error.message
        });
    }
};