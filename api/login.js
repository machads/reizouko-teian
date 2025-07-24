module.exports = async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    console.log('Login API called:', req.method);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        console.log('Method not allowed:', req.method);
        return res.status(405).json({ error: true, message: `Method ${req.method} not allowed` });
    }

    try {
        console.log('Request body:', req.body);
        const { password } = req.body;
        
        if (!password) {
            console.log('No password provided');
            return res.status(400).json({
                error: true,
                message: 'パスワードが必要です'
            });
        }

        // 簡単なパスワードチェック（デバッグ用）
        if (password === 'recipe123') {
            console.log('Password correct');
            res.json({
                success: true,
                message: 'ログインに成功しました'
            });
        } else {
            console.log('Password incorrect:', password);
            res.status(401).json({
                error: true,
                message: 'パスワードが正しくありません'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: true,
            message: 'サーバーエラーが発生しました'
        });
    }
}