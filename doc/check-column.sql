-- Check if assignee_id column exists in tasks table

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name = 'assignee_id';

-- If the above returns no rows, the column doesn't exist yet
-- If it returns a row, the column exists

-- Also check all columns in tasks table:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
