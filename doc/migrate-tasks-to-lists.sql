-- Migration script to assign existing tasks to lists
-- Run this in Supabase SQL Editor after creating the lists table

-- Step 1: Check current task distribution
SELECT 'Tasks without list_id:' as info;
SELECT COUNT(*) as count FROM tasks WHERE list_id IS NULL;

SELECT 'Tasks by folder:' as info;
SELECT 
  f.name as folder_name,
  s.name as space_name,
  COUNT(t.id) as task_count
FROM tasks t
LEFT JOIN folders f ON f.id = t.folder_id
LEFT JOIN spaces s ON s.id = t.space_id
WHERE t.list_id IS NULL
GROUP BY f.name, s.name
ORDER BY task_count DESC;

-- Step 2: Show available lists
SELECT 'Available lists:' as info;
SELECT 
  l.id,
  l.name as list_name,
  f.name as folder_name,
  s.name as space_name
FROM lists l
JOIN folders f ON f.id = l.folder_id
JOIN spaces s ON s.id = f.space_id
ORDER BY s.name, f.name, l.name;

-- Step 3: Assign tasks to "General" list in their folders
UPDATE tasks
SET list_id = (
  SELECT l.id
  FROM lists l
  WHERE l.folder_id = tasks.folder_id
  AND l.name = 'General'
  LIMIT 1
)
WHERE tasks.folder_id IS NOT NULL
AND tasks.list_id IS NULL;

-- Step 4: For tasks with space but no folder, create a default folder and list
DO $$
DECLARE
  task_record RECORD;
  default_folder_id UUID;
  default_list_id UUID;
BEGIN
  -- Loop through tasks that have a space but no folder
  FOR task_record IN 
    SELECT DISTINCT t.space_id, s.name as space_name
    FROM tasks t
    JOIN spaces s ON s.id = t.space_id
    WHERE t.space_id IS NOT NULL 
    AND t.folder_id IS NULL
    AND t.list_id IS NULL
  LOOP
    -- Check if a default folder exists for this space
    SELECT id INTO default_folder_id
    FROM folders
    WHERE space_id = task_record.space_id
    AND name = 'General'
    LIMIT 1;
    
    -- If no default folder exists, create one
    IF default_folder_id IS NULL THEN
      INSERT INTO folders (space_id, name, description, position)
      VALUES (task_record.space_id, 'General', 'Default folder', 0)
      RETURNING id INTO default_folder_id;
      
      RAISE NOTICE 'Created default folder for space: %', task_record.space_name;
    END IF;
    
    -- Check if a General list exists in this folder
    SELECT id INTO default_list_id
    FROM lists
    WHERE folder_id = default_folder_id
    AND name = 'General'
    LIMIT 1;
    
    -- If no General list exists, create one
    IF default_list_id IS NULL THEN
      INSERT INTO lists (folder_id, name, description, position)
      VALUES (default_folder_id, 'General', 'General tasks', 0)
      RETURNING id INTO default_list_id;
      
      RAISE NOTICE 'Created General list for folder in space: %', task_record.space_name;
    END IF;
    
    -- Update tasks to use this folder and list
    UPDATE tasks
    SET 
      folder_id = default_folder_id,
      list_id = default_list_id
    WHERE space_id = task_record.space_id
    AND folder_id IS NULL
    AND list_id IS NULL;
    
    RAISE NOTICE 'Assigned tasks in space % to General folder/list', task_record.space_name;
  END LOOP;
END $$;

-- Step 5: Verify migration
SELECT 'Migration Results:' as info;
SELECT 
  'Total tasks' as category,
  COUNT(*) as count
FROM tasks
UNION ALL
SELECT 
  'Tasks with list_id',
  COUNT(*)
FROM tasks
WHERE list_id IS NOT NULL
UNION ALL
SELECT 
  'Tasks without list_id',
  COUNT(*)
FROM tasks
WHERE list_id IS NULL;

-- Step 6: Show task distribution by list
SELECT 'Tasks per list:' as info;
SELECT 
  s.name as space,
  f.name as folder,
  l.name as list,
  COUNT(t.id) as task_count
FROM lists l
LEFT JOIN tasks t ON t.list_id = l.id
JOIN folders f ON f.id = l.folder_id
JOIN spaces s ON s.id = f.space_id
GROUP BY s.name, f.name, l.name
ORDER BY s.name, f.name, l.name;

-- Step 7: Show any remaining orphaned tasks
SELECT 'Orphaned tasks (if any):' as info;
SELECT 
  t.id,
  t.title,
  t.status,
  s.name as space_name,
  t.folder_id,
  t.list_id
FROM tasks t
LEFT JOIN spaces s ON s.id = t.space_id
WHERE t.list_id IS NULL;
