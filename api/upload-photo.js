const OpenAI = require('openai');
const multiparty = require('multiparty');

// 認証チェック関数
function requireAuth(req) {
    const cookies = req.headers.cookie || '';
    return cookies.includes('authenticated=true');
}

// OpenAI Vision APIを使った画像から食材認識
async function analyzeImageIngredients(imageBuffer) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        
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
        const form = new multiparty.Form();
        
        return new Promise((resolve, reject) => {
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    console.error('Form parse error:', err);
                    return res.status(400).json({
                        error: true,
                        message: 'ファイルの解析に失敗しました'
                    });
                }

                const photoFile = files.photo && files.photo[0];
                if (!photoFile) {
                    return res.status(400).json({
                        error: true,
                        message: '画像ファイルが必要です'
                    });
                }

                // ファイルサイズチェック（10MB以下）
                if (photoFile.size > 10 * 1024 * 1024) {
                    return res.status(400).json({
                        error: true,
                        message: 'ファイルサイズが大きすぎます（10MB以下にしてください）'
                    });
                }

                // ファイル形式チェック
                if (!photoFile.headers['content-type'].startsWith('image/')) {
                    return res.status(400).json({
                        error: true,
                        message: '画像ファイルを選択してください'
                    });
                }

                try {
                    const fs = require('fs');
                    const imageBuffer = fs.readFileSync(photoFile.path);
                    
                    // OpenAI Vision APIを使って実際の画像から食材を認識
                    console.log('画像解析を開始します...');
                    const recognizedIngredients = await analyzeImageIngredients(imageBuffer);
                    
                    console.log('認識された食材:', recognizedIngredients);

                    res.json({
                        success: true,
                        ingredients: recognizedIngredients,
                        message: `${recognizedIngredients.length}個の食材を認識しました`
                    });

                    // 一時ファイルを削除
                    fs.unlinkSync(photoFile.path);
                    
                } catch (error) {
                    console.error('Photo processing error:', error);
                    res.status(500).json({
                        error: true,
                        message: '写真の処理中にエラーが発生しました'
                    });
                    
                    // 一時ファイルを削除
                    try {
                        const fs = require('fs');
                        fs.unlinkSync(photoFile.path);
                    } catch (cleanupError) {
                        console.error('Cleanup error:', cleanupError);
                    }
                }
            });
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: true,
            message: '写真のアップロード中にエラーが発生しました'
        });
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};