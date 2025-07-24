module.exports = function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', 'https://reizouko-teian.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // クッキーから認証状態を確認
    const cookies = req.headers.cookie || '';
    const authenticated = cookies.includes('authenticated=true');
    
    res.json({
        authenticated: authenticated
    });
}