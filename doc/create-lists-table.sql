-- Create lists table
-- Lists belong to folders and contain tasks (like "General", "Urgent", etc.)
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'gray',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  position INTEGER DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX idx_lists_folder_id ON lists(folder_id);

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view lists in folders they have access to
CREATE POLICY "Users can view lists in their folders"
  ON lists FOR SELECT
  USING (
    folder_id IN (
      SELECT f.id 
      FROM folders f
      JOIN spaces s ON s.id = f.space_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Policy: Owners and editors can create lists
CREATE POLICY "Owners and editors can create lists"
  ON lists FOR INSERT
  WITH CHECK (
    folder_id IN (
      SELECT f.id 
      FROM folders f
      JOIN spaces s ON s.id = f.space_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners and editors can update lists
CREATE POLICY "Owners and editors can update lists"
  ON lists FOR UPDATE
  USING (
    folder_id IN (
      SELECT f.id 
      FROM folders f
      JOIN spaces s ON s.id = f.space_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners can delete lists
CREATE POLICY "Owners can delete lists"
  ON lists FOR DELETE
  USING (
    folder_id IN (
      SELECT f.id 
      FROM folders f
      JOIN spaces s ON s.id = f.space_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid() 
      AND wm.permission = 'owner'
    )
  );

-- Add list_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);

-- Create a default "General" list for each existing folder
INSERT INTO lists (folder_id, name, description, position)
SELECT f.id, 'General', 'General tasks', 0
FROM folders f
WHERE NOT EXISTS (
  SELECT 1 FROM lists l WHERE l.folder_id = f.id AND l.name = 'General'
);
