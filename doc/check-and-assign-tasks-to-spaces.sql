-- Check if tasks have space_id assigned
SELECT id, title, workspace_id, space_id FROM tasks LIMIT 10;

-- If space_id is NULL for all tasks, run this to assign them to the first space in each workspace:
UPDATE tasks t
SET space_id = (
  SELECT s.id 
  FROM spaces s 
  WHERE s.workspace_id = t.workspace_id 
  ORDER BY s.position 
  LIMIT 1
)
WHERE t.space_id IS NULL;

-- Verify the update
SELECT 
  t.title,
  w.name as workspace_name,
  s.name as space_name
FROM tasks t
LEFT JOIN workspaces w ON t.workspace_id = w.id
LEFT JOIN spaces s ON t.space_id = s.id
LIMIT 10;
