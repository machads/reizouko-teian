# Claude Code と Supabase の MCP 接続設定

Claude CodeとSupabaseをMCP（Model Context Protocol）で接続する手順です。

## 🎯 MCP接続の利点

- **自然言語でDB操作**: SQLを書かずに日本語でデータベースを操作
- **リアルタイムスキーマ確認**: テーブル構造を即座に確認
- **安全な読み取り専用アクセス**: データの破損リスクを最小化
- **効率的な開発**: AI支援によるデータベース操作

## 🚀 セットアップ手順

### 1. Supabase接続情報の確認

まず、Supabaseの接続情報を取得します。

#### 方法A: Supabase Dashboard
1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. 左サイドバーの「Settings」→「Database」を選択
4. 「Connection string」をコピー

#### 方法B: 既存の環境変数から取得
現在の`.env`ファイルから取得：
```env
SUPABASE_URL=https://yfjrabvfoccasuzrmmev.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. PostgreSQL 接続文字列の作成

Supabase の接続文字列は以下の形式です：
```
postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

例：
```
postgresql://postgres.yfjrabvfoccasuzrmmev:your_db_password@db.yfjrabvfoccasuzrmmev.supabase.co:5432/postgres
```

### 3. Claude Code MCP 設定

#### オプション1: Supabase MCP Server（推奨）

Claude Codeで以下のコマンドを実行：

```bash
# Supabase MCP サーバーを追加
claude mcp add supabase-server @supabase/mcp-server-supabase@latest --project-ref yfjrabvfoccasuzrmmev --read-only
```

#### オプション2: PostgreSQL MCP Server

```bash
# PostgreSQL MCP サーバーを追加
claude mcp add postgres-server @modelcontextprotocol/server-postgres "postgresql://postgres.yfjrabvfoccasuzrmmev:your_password@db.yfjrabvfoccasuzrmmev.supabase.co:5432/postgres"
```

### 4. 設定ファイルの確認

Claude Codeの設定ファイル（通常 `~/.claude/config.json`）に以下が追加されます：

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=yfjrabvfoccasuzrmmev"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

## 🔧 環境変数の設定

### Personal Access Token の取得

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. 右上のアバターをクリック → 「Personal settings」
3. 「Access tokens」タブを選択
4. 「Generate new token」でトークンを作成
5. 作成されたトークンをコピー

### 環境変数の設定

Windows:
```cmd
set SUPABASE_ACCESS_TOKEN=your_personal_access_token
```

Mac/Linux:
```bash
export SUPABASE_ACCESS_TOKEN=your_personal_access_token
```

## 🧪 接続テスト

Claude Codeで以下のコマンドを試してください：

```
> describe the schema of our recipe_suggestions table
```

```
> show me the latest 5 recipe suggestions
```

```
> how many recipes are stored in the database?
```

## 💡 使用例

### データベース構造の確認
```
テーブル一覧を表示してください
```

### データの確認
```
recipe_suggestionsテーブルの最新10件を表示してください
```

### 統計情報の取得
```
各料理ジャンル（和風・洋風・中華）別のレシピ数を教えてください
```

## 🛡️ セキュリティ設定

### 読み取り専用アクセス
```bash
# 読み取り専用で設定（推奨）
claude mcp add supabase-server @supabase/mcp-server-supabase@latest --project-ref yfjrabvfoccasuzrmmev --read-only
```

### 開発環境での使用
本番データベースではなく、開発用データベースでの使用を推奨します。

## 🐛 トラブルシューティング

### 接続エラーの場合
1. **認証情報の確認**: ACCESS_TOKENとPROJECT_REFが正しいか確認
2. **ネットワーク確認**: Supabaseへのアクセスが可能か確認
3. **権限確認**: Personal Access Tokenに適切な権限があるか確認

### よくあるエラー

**エラー**: `Failed to connect to database`
**解決**: 接続文字列のPASSWORDとPROJECT_REFを再確認

**エラー**: `Permission denied`
**解決**: Personal Access Tokenを再生成して設定

## 📚 参考リンク

- [Supabase MCP Documentation](https://supabase.com/docs/guides/getting-started/mcp)
- [Claude Code MCP Guide](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io)

## 🎉 セットアップ完了後

MCP接続が完了すると、Claude Codeで以下のようなことができるようになります：

- データベーススキーマの自動理解
- 自然言語でのSQL実行
- データ分析とレポート生成
- テーブル設計の提案
- データの整合性チェック

これでClaude CodeとSupabaseのMCP接続設定は完了です！