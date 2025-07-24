module.exports = function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    console.log('Auth-status API called:', req.method);
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        console.log('Method not allowed:', req.method);
        return res.status(405).json({ error: true, message: `Method ${req.method} not allowed` });
    }

    // デバッグ用：常に未認証を返す
    console.log('Returning authentication status: false');
    res.json({
        authenticated: false,
        debug: {
            method: req.method,
            headers: req.headers,
            timestamp: new Date().toISOString()
        }
    });
}