module.exports = function handler(req, res) {
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

    // クッキーをクリア（モバイル対応）
    res.setHeader('Set-Cookie', [
        'sessionToken=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0',
        'authenticated=; Path=/; SameSite=Lax; Secure; Max-Age=0',
        'loginTime=; Path=/; SameSite=Lax; Secure; Max-Age=0'
    ]);
    
    console.log('Session cookies cleared');
    
    res.json({
        success: true,
        message: 'ログアウトしました'
    });
}