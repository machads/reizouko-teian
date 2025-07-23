-- 冷蔵庫レシピ提案アプリ用テーブル作成
-- recipe_suggestions テーブルを作成
CREATE TABLE recipe_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredients TEXT[],
    required_seasoning TEXT,
    japanese_recipe TEXT,
    western_recipe TEXT,
    chinese_recipe TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security を有効化
ALTER TABLE recipe_suggestions ENABLE ROW LEVEL SECURITY;

-- 開発用ポリシー（全ユーザーが全操作可能）
CREATE POLICY "Allow all operations for all users" ON recipe_suggestions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- テーブル構造の確認
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'recipe_suggestions'
ORDER BY ordinal_position;