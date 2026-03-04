-- Fix orphaned tasks - assign them to appropriate lists
-- Run this if you still have tasks without list_id after migration

-- Step 1: Show orphaned tasks details
SELECT 'Orphaned Tasks Details:' as info;
SELECT 
  t.id,
  t.title,
  t.status,
  t.workspace_id,
  t.space_id,
  t.folder_id,
  t.list_id,
  w.name as workspace_name,
  s.name as space_name,
  f.name as folder_name
FROM tasks t
LEFT JOIN workspaces w ON w.id = t.workspace_id
LEFT JOIN spaces s ON s.id = t.space_id
LEFT JOIN folders f ON f.id = t.folder_id
WHERE t.list_id IS NULL;

-- Step 2: Handle tasks that have folder but no list_id
-- This assigns them to the first list in their folder
UPDATE tasks
SET list_id = (
  SELECT l.id
  FROM lists l
  WHERE l.folder_id = tasks.folder_id
  ORDER BY l.position
  LIMIT 1
)
WHERE tasks.folder_id IS NOT NULL
AND tasks.list_id IS NULL
AND EXISTS (
  SELECT 1 FROM lists l WHERE l.folder_id = tasks.folder_id
);

-- Step 3: For tasks with space but no folder - create folder and list
DO $$
DECLARE
  task_record RECORD;
  default_folder_id UUID;
  default_list_id UUID;
  user_id UUID;
BEGIN
  -- Get a user_id for creating folders/lists
  SELECT id INTO user_id FROM auth.users LIMIT 1;
  
  -- Loop through each orphaned task with space but no folder
  FOR task_record IN 
    SELECT t.id, t.space_id, s.name as space_name
    FROM tasks t
    JOIN spaces s ON s.id = t.space_id
    WHERE t.space_id IS NOT NULL 
    AND t.folder_id IS NULL
    AND t.list_id IS NULL
  LOOP
    -- Find or create a General folder in this space
    SELECT id INTO default_folder_id
    FROM folders
    WHERE space_id = task_record.space_id
    AND name = 'General'
    LIMIT 1;
    
    IF default_folder_id IS NULL THEN
      INSERT INTO folders (space_id, name, description, position, created_by)
      VALUES (task_record.space_id, 'General', 'Default folder', 0, user_id)
      RETURNING id INTO default_folder_id;
      
      RAISE NOTICE 'Created General folder in space: %', task_record.space_name;
    END IF;
    
    -- Find or create a General list in this folder
    SELECT id INTO default_list_id
    FROM lists
    WHERE folder_id = default_folder_id
    AND name = 'General'
    LIMIT 1;
    
    IF default_list_id IS NULL THEN
      INSERT INTO lists (folder_id, name, description, position, created_by)
      VALUES (default_folder_id, 'General', 'General tasks', 0, user_id)
      RETURNING id INTO default_list_id;
      
      RAISE NOTICE 'Created General list in folder';
    END IF;
    
    -- Assign this task to the folder and list
    UPDATE tasks
    SET 
      folder_id = default_folder_id,
      list_id = default_list_id
    WHERE id = task_record.id;
    
    RAISE NOTICE 'Fixed task: % in space: %', task_record.id, task_record.space_name;
  END LOOP;
END $$;

-- Step 4: For tasks with only workspace_id - create space, folder, and list
DO $$
DECLARE
  task_record RECORD;
  default_space_id UUID;
  default_folder_id UUID;
  default_list_id UUID;
  user_id UUID;
BEGIN
  -- Get a user_id for creating items
  SELECT id INTO user_id FROM auth.users LIMIT 1;
  
  -- Loop through orphaned tasks with only workspace
  FOR task_record IN 
    SELECT t.id, t.workspace_id, w.name as workspace_name
    FROM tasks t
    JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.workspace_id IS NOT NULL
    AND t.space_id IS NULL
    AND t.folder_id IS NULL
    AND t.list_id IS NULL
  LOOP
    -- Find or create a General space
    SELECT id INTO default_space_id
    FROM spaces
    WHERE workspace_id = task_record.workspace_id
    AND name = 'General'
    LIMIT 1;
    
    IF default_space_id IS NULL THEN
      INSERT INTO spaces (workspace_id, name, description, color, position, created_by)
      VALUES (task_record.workspace_id, 'General', 'Default space', 'blue', 0, user_id)
      RETURNING id INTO default_space_id;
      
      RAISE NOTICE 'Created General space in workspace: %', task_record.workspace_name;
    END IF;
    
    -- Find or create a General folder
    SELECT id INTO default_folder_id
    FROM folders
    WHERE space_id = default_space_id
    AND name = 'General'
    LIMIT 1;
    
    IF default_folder_id IS NULL THEN
      INSERT INTO folders (space_id, name, description, position, created_by)
      VALUES (default_space_id, 'General', 'Default folder', 0, user_id)
      RETURNING id INTO default_folder_id;
      
      RAISE NOTICE 'Created General folder';
    END IF;
    
    -- Find or create a General list
    SELECT id INTO default_list_id
    FROM lists
    WHERE folder_id = default_folder_id
    AND name = 'General'
    LIMIT 1;
    
    IF default_list_id IS NULL THEN
      INSERT INTO lists (folder_id, name, description, position, created_by)
      VALUES (default_folder_id, 'General', 'General tasks', 0, user_id)
      RETURNING id INTO default_list_id;
      
      RAISE NOTICE 'Created General list';
    END IF;
    
    -- Assign this task to space, folder, and list
    UPDATE tasks
    SET 
      space_id = default_space_id,
      folder_id = default_folder_id,
      list_id = default_list_id
    WHERE id = task_record.id;
    
    RAISE NOTICE 'Fixed task: % in workspace: %', task_record.id, task_record.workspace_name;
  END LOOP;
END $$;

-- Step 5: Final verification
SELECT 'Final Results:' as info;
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
  'Orphaned tasks remaining',
  COUNT(*)
FROM tasks
WHERE list_id IS NULL;

-- Step 6: If still orphaned, show them
SELECT 'Still Orphaned (if any):' as info;
SELECT 
  t.id,
  t.title,
  t.workspace_id,
  t.space_id,
  t.folder_id,
  t.list_id
FROM tasks t
WHERE t.list_id IS NULL;
