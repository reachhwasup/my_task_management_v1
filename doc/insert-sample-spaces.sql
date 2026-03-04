-- Step 1: Find your workspace IDs
-- Run this query first to get your actual workspace IDs:

SELECT id, name, type FROM workspaces;

-- Step 2: Copy the UUID from the results above and use them below
-- Example output will look like:
-- id                                    | name        | type
-- 12345678-1234-1234-1234-123456789abc | My Workspace| personal

-- Step 3: Insert spaces for each workspace
-- Replace the UUIDs below with your actual workspace IDs from Step 1

-- Example: If your workspace ID is '12345678-1234-1234-1234-123456789abc'
-- INSERT INTO spaces (workspace_id, name, color, position) VALUES
-- ('12345678-1234-1234-1234-123456789abc', 'Personal Projects', 'purple', 0),
-- ('12345678-1234-1234-1234-123456789abc', 'Work Tasks', 'blue', 1);

-- Template for multiple workspaces:
-- Workspace 1 spaces:
-- INSERT INTO spaces (workspace_id, name, color, position) VALUES
-- ('PASTE-WORKSPACE-1-UUID-HERE', 'Project / Assessment', 'blue', 0),
-- ('PASTE-WORKSPACE-1-UUID-HERE', 'Personal Tasks', 'purple', 1);

-- Workspace 2 spaces:
-- INSERT INTO spaces (workspace_id, name, color, position) VALUES
-- ('PASTE-WORKSPACE-2-UUID-HERE', 'INFOSEC (GOV)', 'red', 0),
-- ('PASTE-WORKSPACE-2-UUID-HERE', 'INFOSEC (SOC)', 'blue', 1),
-- ('PASTE-WORKSPACE-2-UUID-HERE', 'CYBER SECURITY', 'red', 2);
