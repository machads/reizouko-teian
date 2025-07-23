# 🥘 冷蔵庫レシピ提案アプリ

冷蔵庫の中にある食材を写真またはテキストで入力し、AI（ChatGPT）が和風・洋風・中華料理のレシピを提案するWebアプリケーションです。

## ⚡ 最速スタート

```bash
# 1. アプリを起動（自動でブラウザが開きます）
npm start
```

これだけでアプリが起動し、ブラウザで自動的に開きます！

## 🎯 主な機能

- 📝 **テキスト入力**: 食材を手動で入力
- 📷 **写真認識**: 冷蔵庫の写真から食材を自動認識
- 🎭 **気分指定**: 「さっぱり」「こってり」など気分に合わせたレシピ
- 🍽️ **3ジャンル提案**: 和風・洋風・中華の同時提案
- 📱 **レスポンシブ**: スマホ・タブレット・PC対応
- 🌙 **ダークモード**: システム設定に自動対応

## 🚀 詳細セットアップ

### 1. 事前準備
- Node.js (v16以上)
- OpenAI APIキー ([取得方法](https://platform.openai.com))
- Supabaseアカウント ([登録](https://supabase.com))

### 2. 環境変数の設定

#### 2.1 Supabaseセットアップ
詳細は[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)を参照

#### 2.2 OpenAI APIキー設定
`backend/.env`ファイルを設定：
```env
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

### 3. 手動起動（開発者向け）

```bash
# 依存関係のインストール
npm run setup

# バックエンドとフロントエンドを同時起動
npm run dev

# 個別起動
npm run backend  # バックエンドのみ
npm run frontend # フロントエンドのみ
```

## 📱 使用方法

1. **食材入力**: テキストエリアに冷蔵庫にある食材をカンマ区切りで入力
   - 例: `鶏肉, キャベツ, 人参, 玉ねぎ`

2. **調味料指定（オプション）**: 使いたい特定の調味料があれば入力
   - 例: `カレー粉`, `味噌`, `オイスターソース`

3. **レシピ提案**: 「レシピを提案」ボタンをクリック

4. **結果確認**: 和風・洋風・中華のタブで各レシピを確認

## 🛠️ 技術スタック

- **フロントエンド**: HTML, CSS, バニラJavaScript
- **バックエンド**: Node.js, Express
- **データベース**: Supabase
- **AI**: OpenAI API (GPT-4)

## 📂 プロジェクト構造

```
reizouko-teian/
├── frontend/
│   ├── index.html      # メインHTMLページ
│   ├── style.css       # スタイルシート
│   └── app.js          # フロントエンドロジック
├── backend/
│   ├── server.js       # Expressサーバー
│   ├── package.json    # 依存関係
│   └── .env           # 環境変数
├── SUPABASE_SETUP.md   # Supabase設定ガイド
└── README.md          # このファイル
```

## 🧪 テスト

### API エンドポイント

**ヘルスチェック:**
```
GET http://localhost:3000/api/health
```

**設定確認:**
```
GET http://localhost:3000/api/test-config
```

**レシピ提案:**
```
POST http://localhost:3000/api/suggest-recipes
Content-Type: application/json

{
  "ingredients": ["鶏肉", "キャベツ", "人参"],
  "requiredSeasoning": "カレー粉"
}
```

### 手動テスト手順

1. **バックエンドテスト**
   ```bash
   cd backend
   npm start
   ```
   - ブラウザで http://localhost:3000/api/health にアクセス
   - `{"status":"OK","timestamp":"...","environment":"development"}` が表示されることを確認

2. **設定確認**
   - http://localhost:3000/api/test-config にアクセス
   - `openaiConfigured` と `supabaseConfigured` が `true` であることを確認

3. **フロントエンドテスト**
   - `frontend/index.html` をブラウザで開く
   - 食材を入力してレシピ提案をテスト
   - 和洋中のタブが正常に切り替わることを確認

4. **エラーハンドリングテスト**
   - 空の食材で送信してエラーメッセージを確認
   - バックエンドを停止してネットワークエラーを確認

## 🚨 トラブルシューティング

### よくある問題

**1. "サーバーに接続できませんでした"**
- バックエンドサーバーが起動しているか確認
- ポート3000が他のプロセスで使用されていないか確認

**2. "OpenAI APIの認証に失敗しました"**
- `.env`ファイルの`OPENAI_API_KEY`が正しく設定されているか確認
- APIキーに有効な課金情報が設定されているか確認

**3. "Supabase connection failed"**
- `.env`ファイルの`SUPABASE_URL`と`SUPABASE_ANON_KEY`を確認
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)に従って設定を確認

### ログの確認

バックエンドのコンソール出力を確認：
```
🚀 Server is running on port 3000
📝 API endpoint: http://localhost:3000/api/suggest-recipes
🏥 Health check: http://localhost:3000/api/health
⚙️  Config check: http://localhost:3000/api/test-config
```

## 🔮 今後の拡張予定

- [ ] 写真からの食材認識機能
- [ ] レシピのお気に入り保存
- [ ] 調理履歴の記録
- [ ] 栄養価情報の表示
- [ ] 複数人数分の分量調整
- [ ] ユーザー認証機能

## 📄 ライセンス

ISC License

## 🤝 コントリビューション

プルリクエストやIssueは歓迎します！

---

💡 **Tip**: 初回起動時は[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)を必ず確認してください。