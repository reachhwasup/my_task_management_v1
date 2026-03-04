-- Create spaces table
-- Spaces belong to a workspace and help organize projects/teams
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  position INTEGER DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX idx_spaces_workspace_id ON spaces(workspace_id);

-- Enable RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view spaces in workspaces they're members of
CREATE POLICY "Users can view spaces in their workspaces"
  ON spaces FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Owners and editors can create spaces
CREATE POLICY "Owners and editors can create spaces"
  ON spaces FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners and editors can update spaces
CREATE POLICY "Owners and editors can update spaces"
  ON spaces FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND permission IN ('owner', 'editor')
    )
  );

-- Policy: Owners can delete spaces
CREATE POLICY "Owners can delete spaces"
  ON spaces FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND permission = 'owner'
    )
  );
