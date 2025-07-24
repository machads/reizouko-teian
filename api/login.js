const bcrypt = require('bcrypt');

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

    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({
                error: true,
                message: 'パスワードが必要です'
            });
        }

        // パスワードハッシュと比較
        const passwordHash = process.env.APP_PASSWORD_HASH;
        
        if (!passwordHash) {
            console.error('APP_PASSWORD_HASH is not configured');
            return res.status(500).json({
                error: true,
                message: 'サーバー設定エラーです'
            });
        }

        const isValid = await bcrypt.compare(password, passwordHash);
        
        if (isValid) {
            // セッション情報をクッキーに設定
            res.setHeader('Set-Cookie', [
                `authenticated=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2 * 60 * 60}`,
                `loginTime=${Date.now()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2 * 60 * 60}`
            ]);
            
            res.json({
                success: true,
                message: 'ログインに成功しました'
            });
        } else {
            // ログイン試行の記録
            console.warn(`Failed login attempt from IP: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress} at ${new Date().toISOString()}`);
            
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