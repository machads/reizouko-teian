const bcrypt = require('bcrypt');

// パスワードを変更してください
const password = 'your-secure-password-here';

// bcryptでハッシュ化（saltRounds = 10）
const hash = bcrypt.hashSync(password, 10);

console.log('=== パスワードハッシュ生成 ===');
console.log('元のパスワード:', password);
console.log('ハッシュ化された値:', hash);
console.log('');
console.log('このハッシュ値をVercelの APP_PASSWORD_HASH 環境変数に設定してください');

// 検証テスト
const isValid = bcrypt.compareSync(password, hash);
console.log('検証テスト:', isValid ? '✅ 成功' : '❌ 失敗');