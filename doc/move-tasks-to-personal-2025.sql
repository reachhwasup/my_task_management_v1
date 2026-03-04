-- Script to move existing tasks to Personal space and 2025 folder
-- Run this in Supabase SQL Editor

-- Step 1: Check existing spaces and folders
SELECT 'Existing Spaces:' as info;
SELECT id, name, workspace_id FROM spaces ORDER BY name;

SELECT 'Existing Folders:' as info;
SELECT f.id, f.name, f.space_id, s.name as space_name 
FROM folders f
JOIN spaces s ON s.id = f.space_id
ORDER BY s.name, f.name;

-- Step 2: Find the Personal space (adjust workspace_id if needed)
-- First, let's see your workspaces:
SELECT 'Your Workspaces:' as info;
SELECT id, name, type FROM workspaces;

-- Step 3: Get the Personal space ID and 2025 folder ID
-- Replace 'your-workspace-id' with your actual workspace ID from above
DO $$
DECLARE
  personal_space_id UUID;
  folder_2025_id UUID;
  target_workspace_id UUID;
BEGIN
  -- Get your workspace (adjust if you have multiple workspaces)
  -- This gets the first workspace, change the WHERE clause if needed
  SELECT id INTO target_workspace_id FROM workspaces LIMIT 1;
  
  -- Get or create Personal space
  SELECT id INTO personal_space_id 
  FROM spaces 
  WHERE name ILIKE '%personal%' 
  AND workspace_id = target_workspace_id
  LIMIT 1;
  
  -- If Personal space doesn't exist, you can create it:
  IF personal_space_id IS NULL THEN
    INSERT INTO spaces (workspace_id, name, description, color, position)
    VALUES (target_workspace_id, 'Personal', 'Personal tasks and projects', 'blue', 0)
    RETURNING id INTO personal_space_id;
    
    RAISE NOTICE 'Created Personal space with ID: %', personal_space_id;
  ELSE
    RAISE NOTICE 'Found Personal space with ID: %', personal_space_id;
  END IF;
  
  -- Get or create 2025 folder
  SELECT id INTO folder_2025_id 
  FROM folders 
  WHERE name = '2025' 
  AND space_id = personal_space_id
  LIMIT 1;
  
  IF folder_2025_id IS NULL THEN
    INSERT INTO folders (space_id, name, description, position)
    VALUES (personal_space_id, '2025', 'Tasks for 2025', 0)
    RETURNING id INTO folder_2025_id;
    
    RAISE NOTICE 'Created 2025 folder with ID: %', folder_2025_id;
  ELSE
    RAISE NOTICE 'Found 2025 folder with ID: %', folder_2025_id;
  END IF;
  
  -- Update all tasks that don't have a space_id or folder_id
  UPDATE tasks
  SET 
    space_id = personal_space_id,
    folder_id = folder_2025_id
  WHERE workspace_id = target_workspace_id
  AND (space_id IS NULL OR folder_id IS NULL);
  
  RAISE NOTICE 'Tasks updated successfully!';
  
  -- Show summary
  RAISE NOTICE 'Summary:';
  RAISE NOTICE 'Personal Space ID: %', personal_space_id;
  RAISE NOTICE 'Folder 2025 ID: %', folder_2025_id;
  RAISE NOTICE 'Workspace ID: %', target_workspace_id;
END $$;

-- Step 4: Verify the migration
SELECT 'Tasks in Personal/2025:' as info;
SELECT t.id, t.title, t.status, s.name as space, f.name as folder
FROM tasks t
LEFT JOIN spaces s ON s.id = t.space_id
LEFT JOIN folders f ON f.id = t.folder_id
WHERE s.name ILIKE '%personal%';

-- Step 5: Check for any orphaned tasks
SELECT 'Orphaned Tasks (no space/folder):' as info;
SELECT id, title, status, workspace_id, space_id, folder_id
FROM tasks
WHERE space_id IS NULL OR folder_id IS NULL;
