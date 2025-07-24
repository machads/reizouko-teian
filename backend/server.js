const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
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
            scriptSrc: ["'self'", "'unsafe-eval'"],
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

// セッション設定
app.use(session({
    secret: 'recipe-app-secret-key-1223', // セッションキー
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTPSでない場合はfalse
        maxAge: 24 * 60 * 60 * 1000 // 24時間
    }
}));

// 認証チェックミドルウェア
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({
            error: true,
            message: '認証が必要です',
            requireAuth: true
        });
    }
};

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
    'http://localhost:9000',
    'http://localhost:8888',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:9000',
    'http://127.0.0.1:8888'
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

// OpenAI Vision APIを使った画像から食材認識
async function analyzeImageIngredients(imageBuffer) {
    try {
        // 画像をbase64エンコード
        const base64Image = imageBuffer.toString('base64');
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `この画像を見て、写っている食材を認識してください。以下の条件に従ってください：

1. 食材のみを認識し、調理済みの料理は除外してください
2. 野菜、肉類、魚類、果物、乳製品、調味料など、料理に使える食材を対象とします
3. 結果は日本語の食材名で、カンマ区切りで返してください
4. 同じ種類の食材が複数見える場合は1つだけ記載してください
5. 不明瞭な場合は推測で構いません
6. 最大20個までに制限してください

例: トマト,玉ねぎ,鶏肉,じゃがいも

食材名のみを返してください（他の説明は不要）:`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 200
        });

        const recognizedText = response.choices[0]?.message?.content?.trim();
        
        if (!recognizedText) {
            throw new Error('画像認識結果が空です');
        }

        // カンマ区切りで分割し、前後の空白を除去
        const ingredients = recognizedText
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .slice(0, 20); // 安全のため20個に制限

        console.log('画像認識結果:', ingredients);
        return ingredients;

    } catch (error) {
        console.error('画像認識エラー:', error);
        
        // エラーの場合はデフォルトの食材を返す
        const defaultIngredients = ['不明な食材', '画像認識に失敗しました'];
        return defaultIngredients;
    }
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

// ログインエンドポイント
app.post('/api/login', [
    body('password').notEmpty().withMessage('パスワードが必要です')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: true,
            message: 'バリデーションエラー',
            details: errors.array()
        });
    }

    const { password } = req.body;
    
    // パスワードチェック
    if (password === '1223') {
        req.session.authenticated = true;
        res.json({
            success: true,
            message: 'ログインに成功しました'
        });
    } else {
        res.status(401).json({
            error: true,
            message: 'パスワードが間違っています'
        });
    }
});

// ログアウトエンドポイント
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                error: true,
                message: 'ログアウトに失敗しました'
            });
        }
        res.json({
            success: true,
            message: 'ログアウトしました'
        });
    });
});

// 認証状態確認エンドポイント
app.get('/api/auth-status', (req, res) => {
    res.json({
        authenticated: !!req.session.authenticated
    });
});

// 写真アップロード用エンドポイント（認証必須）
app.post('/api/upload-photo', requireAuth, uploadLimiter, upload.single('photo'), async (req, res) => {
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

        // OpenAI Vision APIを使って実際の画像から食材を認識
        console.log('画像解析を開始します...');
        const recognizedIngredients = await analyzeImageIngredients(optimizedBuffer);
        
        console.log('認識された食材:', recognizedIngredients);

        res.json({
            success: true,
            ingredients: recognizedIngredients,
            message: `${recognizedIngredients.length}個の食材を認識しました`,
            debug: {
                imageSize: `${req.file.size} bytes`,
                optimizedSize: `${optimizedBuffer.length} bytes`,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({
            error: true,
            message: '写真の処理中にエラーが発生しました'
        });
    }
});

app.post('/api/suggest-recipes', requireAuth, recipeLimiter, recipeValidationRules, handleValidationErrors, async (req, res) => {
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
        
        // 画像生成は無効化
        // レシピはシンプルな文字列形式で返す
        
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