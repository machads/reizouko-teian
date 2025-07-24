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

        // パスワードチェック
        if (password === 'recipe123') {
            console.log('Password correct');
            
            // セッション情報をクッキーに設定（モバイル対応）
            const sessionToken = `auth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2時間後
            
            res.setHeader('Set-Cookie', [
                `sessionToken=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`,
                `authenticated=true; Path=/; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`,
                `loginTime=${Date.now()}; Path=/; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`
            ]);
            
            console.log('Session cookies set:', sessionToken);
            
            res.json({
                success: true,
                message: 'ログインに成功しました',
                sessionToken: sessionToken // デバッグ用
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