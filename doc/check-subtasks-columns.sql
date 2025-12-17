-- Check if assignee_id and due_date columns exist in subtasks table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subtasks'
  AND column_name IN ('assignee_id', 'due_date')
ORDER BY ordinal_position;
