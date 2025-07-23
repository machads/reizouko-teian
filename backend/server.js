const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// セキュリティミドルウェア
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// レート制限
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト/15分
    message: {
        error: true,
        message: 'リクエストが多すぎます。しばらく待ってからお試しください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const recipeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 10, // 最大10回のレシピ提案/15分
    message: {
        error: true,
        message: 'レシピ提案の回数制限に達しました。15分後にお試しください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分
    max: 5, // 最大5回のアップロード/1分
    message: {
        error: true,
        message: 'ファイルアップロードの回数制限に達しました。1分後にお試しください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

// CORS設定
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON/URLエンコードされたデータのパース
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// マルチパート（ファイルアップロード）の設定
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB制限
        files: 1 // 1ファイルのみ
    },
    fileFilter: (req, file, cb) => {
        // 画像ファイルのみ許可
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('画像ファイルのみアップロード可能です'));
        }
    }
});

// 入力サニタイゼーション
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[<>]/g, '') // XSS対策
        .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z0-9\s,、。！？]/g, '') // 許可文字のみ
        .trim()
        .slice(0, 500); // 長さ制限
}

// バリデーションルール
const recipeValidationRules = [
    body('ingredients')
        .isArray({ min: 1, max: 20 })
        .withMessage('食材は1〜20個で入力してください'),
    body('ingredients.*')
        .isString()
        .isLength({ min: 1, max: 50 })
        .withMessage('食材名は1〜50文字で入力してください')
        .customSanitizer(sanitizeInput),
    body('requiredSeasoning')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('調味料は100文字以内で入力してください')
        .customSanitizer(sanitizeInput),
    body('moodRequest')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('気分・要望は200文字以内で入力してください')
        .customSanitizer(sanitizeInput)
];

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: true,
            message: '入力内容に問題があります',
            details: errors.array().map(err => err.msg)
        });
    }
    next();
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
【ポイント】○○○○`;
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

async function saveRecipeToSupabase(ingredients, requiredSeasoning, moodRequest, recipes) {
    try {
        const { data, error } = await supabase
            .from('recipe_suggestions')
            .insert([
                {
                    ingredients: ingredients,
                    required_seasoning: requiredSeasoning || null,
                    mood_request: moodRequest || null,
                    japanese_recipe: recipes.japanese,
                    western_recipe: recipes.western,
                    chinese_recipe: recipes.chinese
                }
            ]);
        
        if (error) {
            console.error('Supabase save error:', error);
        } else {
            console.log('Recipe saved to Supabase successfully');
        }
    } catch (error) {
        console.error('Supabase save error:', error);
    }
}

// 写真アップロード用エンドポイント
app.post('/api/upload-photo', uploadLimiter, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: '画像ファイルが必要です'
            });
        }

        // 画像の最適化（Sharp使用）
        const optimizedBuffer = await sharp(req.file.buffer)
            .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        // 今はデモ用の食材認識結果を返す
        // 実際にはGoogle Cloud Vision APIやOpenAI Vision APIを使用
        const demoIngredients = ['鶏肉', 'キャベツ', '人参', '玉ねぎ', '卵', 'じゃがいも'];
        
        // 実際の画像認識処理をシミュレート
        await new Promise(resolve => setTimeout(resolve, 1000));

        res.json({
            success: true,
            ingredients: demoIngredients,
            message: '食材を認識しました'
        });

    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({
            error: true,
            message: '写真の処理中にエラーが発生しました'
        });
    }
});

app.post('/api/suggest-recipes', recipeLimiter, recipeValidationRules, handleValidationErrors, async (req, res) => {
    try {
        const { ingredients, requiredSeasoning, moodRequest } = req.body;
        
        console.log('Recipe request received:', { ingredients, requiredSeasoning, moodRequest });
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: true,
                message: 'OpenAI APIキーが設定されていません。'
            });
        }
        
        const prompt = createRecipePrompt(ingredients, requiredSeasoning, moodRequest);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
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
        
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            await saveRecipeToSupabase(ingredients, requiredSeasoning, moodRequest, recipes);
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
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/test-config', (req, res) => {
    const config = {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(config);
});

app.use('*', (req, res) => {
    res.status(404).json({
        error: true,
        message: 'エンドポイントが見つかりません。'
    });
});

app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: true,
        message: '内部サーバーエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/suggest-recipes`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`⚙️  Config check: http://localhost:${PORT}/api/test-config`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  Warning: OPENAI_API_KEY is not set');
    }
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.warn('⚠️  Warning: Supabase configuration is incomplete');
    }
});