-- recipe_suggestions テーブルにmood_requestカラムを追加
ALTER TABLE recipe_suggestions 
ADD COLUMN mood_request TEXT;

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