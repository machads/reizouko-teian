export default function handler(req, res) {
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

    // クッキーをクリア
    res.setHeader('Set-Cookie', [
        'authenticated=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
        'loginTime=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
    
    res.json({
        success: true,
        message: 'ログアウトしました'
    });
}