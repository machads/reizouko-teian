const crypto = require('crypto');

// セキュアなランダム文字列を生成
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('=== セッション秘密鍵生成 ===');
console.log('SESSION_SECRET:', sessionSecret);
console.log('長さ:', sessionSecret.length, '文字');
console.log('');
console.log('この値をVercelの SESSION_SECRET 環境変数に設定してください');
console.log('');

// 追加の秘密鍵も生成
console.log('=== 追加のランダム文字列 ===');
for (let i = 1; i <= 3; i++) {
    console.log(`選択肢${i}:`, crypto.randomBytes(32).toString('hex'));
}