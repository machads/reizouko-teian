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

    // クッキーから認証状態を確認
    const cookies = req.headers.cookie || '';
    console.log('Received cookies:', cookies);
    
    const authenticated = cookies.includes('authenticated=true');
    const hasSessionToken = cookies.includes('sessionToken=');
    
    console.log('Authentication check:', { authenticated, hasSessionToken });
    
    res.json({
        authenticated: authenticated && hasSessionToken,
        debug: {
            method: req.method,
            cookiesReceived: cookies,
            hasAuthCookie: authenticated,
            hasSessionToken: hasSessionToken,
            timestamp: new Date().toISOString()
        }
    });
}