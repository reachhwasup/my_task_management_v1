-- Final cleanup - Force assign ALL remaining orphaned tasks
-- This script ensures EVERY task gets a list_id

DO $$
DECLARE
  task_record RECORD;
  target_workspace_id UUID;
  target_space_id UUID;
  target_folder_id UUID;
  target_list_id UUID;
  user_id UUID;
BEGIN
  -- Get first available user_id
  SELECT id INTO user_id FROM auth.users LIMIT 1;
  
  -- Process each orphaned task individually
  FOR task_record IN 
    SELECT * FROM tasks WHERE list_id IS NULL
  LOOP
    RAISE NOTICE 'Processing orphaned task: % - %', task_record.id, task_record.title;
    
    -- Determine workspace
    target_workspace_id := task_record.workspace_id;
    
    IF target_workspace_id IS NULL THEN
      -- Get first available workspace
      SELECT id INTO target_workspace_id FROM workspaces LIMIT 1;
      RAISE NOTICE 'No workspace - using first available: %', target_workspace_id;
    END IF;
    
    -- Determine or create space
    target_space_id := task_record.space_id;
    
    IF target_space_id IS NULL THEN
      -- Find or create a General space
      SELECT id INTO target_space_id
      FROM spaces
      WHERE workspace_id = target_workspace_id
      ORDER BY position
      LIMIT 1;
      
      IF target_space_id IS NULL THEN
        INSERT INTO spaces (workspace_id, name, description, color, position, created_by)
        VALUES (target_workspace_id, 'General', 'Default space', 'blue', 0, user_id)
        RETURNING id INTO target_space_id;
        RAISE NOTICE 'Created new General space: %', target_space_id;
      ELSE
        RAISE NOTICE 'Using existing space: %', target_space_id;
      END IF;
    END IF;
    
    -- Determine or create folder
    target_folder_id := task_record.folder_id;
    
    IF target_folder_id IS NULL THEN
      -- Find or create a folder in the space
      SELECT id INTO target_folder_id
      FROM folders
      WHERE space_id = target_space_id
      ORDER BY position
      LIMIT 1;
      
      IF target_folder_id IS NULL THEN
        INSERT INTO folders (space_id, name, description, position, created_by)
        VALUES (target_space_id, 'General', 'Default folder', 0, user_id)
        RETURNING id INTO target_folder_id;
        RAISE NOTICE 'Created new folder: %', target_folder_id;
      ELSE
        RAISE NOTICE 'Using existing folder: %', target_folder_id;
      END IF;
    END IF;
    
    -- Find or create a list in the folder
    SELECT id INTO target_list_id
    FROM lists
    WHERE folder_id = target_folder_id
    ORDER BY position
    LIMIT 1;
    
    IF target_list_id IS NULL THEN
      INSERT INTO lists (folder_id, name, description, position, created_by)
      VALUES (target_folder_id, 'General', 'General tasks', 0, user_id)
      RETURNING id INTO target_list_id;
      RAISE NOTICE 'Created new list: %', target_list_id;
    ELSE
      RAISE NOTICE 'Using existing list: %', target_list_id;
    END IF;
    
    -- Update the task with all required IDs
    UPDATE tasks
    SET 
      workspace_id = target_workspace_id,
      space_id = target_space_id,
      folder_id = target_folder_id,
      list_id = target_list_id
    WHERE id = task_record.id;
    
    RAISE NOTICE 'Successfully assigned task % to list %', task_record.id, target_list_id;
    RAISE NOTICE '---';
  END LOOP;
  
  RAISE NOTICE 'Cleanup complete!';
END $$;

-- Verify results
SELECT 'FINAL VERIFICATION:' as status;

SELECT 
  'Total tasks' as metric,
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
  'Tasks without list_id (should be 0)',
  COUNT(*)
FROM tasks
WHERE list_id IS NULL;

-- Show task distribution
SELECT 'Task Distribution by List:' as info;
SELECT 
  w.name as workspace,
  s.name as space,
  f.name as folder,
  l.name as list,
  COUNT(t.id) as task_count
FROM tasks t
JOIN workspaces w ON w.id = t.workspace_id
JOIN spaces s ON s.id = t.space_id
JOIN folders f ON f.id = t.folder_id
JOIN lists l ON l.id = t.list_id
GROUP BY w.name, s.name, f.name, l.name
ORDER BY w.name, s.name, f.name, l.name;

-- Final check - should return nothing
SELECT 'Any remaining orphaned tasks (should be empty):' as check;
SELECT 
  id,
  title,
  workspace_id,
  space_id,
  folder_id,
  list_id
FROM tasks
WHERE list_id IS NULL;
