# Vercel デプロイメントガイド

## 事前準備

1. **Vercel アカウントの作成**
   - https://vercel.com にアクセスしてアカウントを作成

2. **GitHub リポジトリにプッシュ**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

## デプロイ手順

### 1. Vercel CLI を使用する場合

```bash
# Vercel CLI をインストール
npm i -g vercel

# プロジェクトディレクトリでデプロイ
vercel

# 初回デプロイ時の質問への回答例:
# ? Set up and deploy "~/reizouko-teian"? [Y/n] y
# ? Which scope do you want to deploy to? [your-username]
# ? Link to existing project? [y/N] n
# ? What's your project's name? reizouko-teian
# ? In which directory is your code located? ./
```

### 2. Vercel ダッシュボードを使用する場合

1. https://vercel.com/dashboard にアクセス
2. "New Project" をクリック
3. GitHub リポジトリを選択
4. プロジェクト設定:
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: (空にする)
   - Output Directory: (空にする)

## 環境変数の設定

Vercel ダッシュボードの Settings > Environment Variables で以下を設定:

### 必須の環境変数
- `OPENAI_API_KEY`: OpenAI API キー
- `SUPABASE_URL`: Supabase プロジェクト URL
- `SUPABASE_ANON_KEY`: Supabase 匿名キー
- `APP_PASSWORD_HASH`: bcrypt でハッシュ化されたパスワード
- `SESSION_SECRET`: セッション用秘密鍵（32文字以上のランダム文字列）
- `NODE_ENV`: production
- `FRONTEND_URL`: https://your-app-name.vercel.app

### パスワードハッシュの生成方法
```bash
# Node.js でパスワードハッシュを生成
node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('your_password', 10));"
```

## デプロイ後の確認

1. **ヘルスチェック**: `https://your-app-name.vercel.app/api/health`
2. **ログイン画面**: `https://your-app-name.vercel.app/login.html`
3. **メインアプリ**: `https://your-app-name.vercel.app/`

## トラブルシューティング

### よくある問題

1. **API エンドポイントが 404 エラー**
   - `vercel.json` の routes 設定を確認
   - 環境変数が正しく設定されているか確認

2. **CORS エラー**
   - `FRONTEND_URL` 環境変数が正しく設定されているか確認

3. **ファイルアップロードエラー**
   - Vercel の制限: 関数実行時間は最大 10 秒
   - 大きなファイルの場合は制限に注意

### ログの確認方法
```bash
# Vercel CLI でログを確認
vercel logs https://your-app-name.vercel.app
```

## 本番環境での注意事項

1. **セキュリティ**
   - 全ての環境変数が適切に設定されていることを確認
   - セッション秘密鍵は十分に複雑なものを使用

2. **パフォーマンス**
   - 画像アップロードは10MBまで
   - OpenAI API の応答時間に注意

3. **モニタリング**
   - Vercel ダッシュボードでアクセスログとエラーログを監視
   - OpenAI API の使用量を監視