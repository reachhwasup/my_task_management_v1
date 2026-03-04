-- Create folders table
-- Folders belong to spaces and help organize tasks by year, project, or category
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'gray',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  position INTEGER DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX idx_folders_space_id ON folders(space_id);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view folders in spaces they have access to
CREATE POLICY "Users can view folders in their spaces"
  ON folders FOR SELECT
  USING (
    space_id IN (
      SELECT s.id 
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Policy: Owners and editors can create folders
CREATE POLICY "Owners and editors can create folders"
  ON folders FOR INSERT
  WITH CHECK (
    space_id IN (
      SELECT s.id 
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners and editors can update folders
CREATE POLICY "Owners and editors can update folders"
  ON folders FOR UPDATE
  USING (
    space_id IN (
      SELECT s.id 
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners can delete folders
CREATE POLICY "Owners can delete folders"
  ON folders FOR DELETE
  USING (
    space_id IN (
      SELECT s.id 
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission = 'owner'
    )
  );

-- Add folder_id to tasks table (optional - tasks can belong to folders)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_folder_id ON tasks(folder_id);
