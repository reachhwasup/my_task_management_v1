-- Check current RLS policies on tasks table
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'tasks';

-- The issue is likely that when filtering by space_id, 
-- Supabase can't verify access because spaces RLS is applied.
-- We need to ensure the tasks RLS policy accounts for space access.

-- Option 1: Update tasks SELECT policy to handle space filtering
-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can view tasks in their workspaces" ON tasks;

-- Create new policy that accounts for spaces
CREATE POLICY "Users can view tasks in their workspaces and spaces"
  ON tasks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
    OR
    space_id IN (
      SELECT s.id
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );
