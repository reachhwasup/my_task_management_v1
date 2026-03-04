-- Add space_id column to tasks table
ALTER TABLE tasks ADD COLUMN space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_tasks_space_id ON tasks(space_id);

-- Update existing tasks to assign them to the first space in their workspace (optional)
-- This will help migrate existing tasks
UPDATE tasks t
SET space_id = (
  SELECT s.id 
  FROM spaces s 
  WHERE s.workspace_id = t.workspace_id 
  ORDER BY s.position 
  LIMIT 1
)
WHERE t.space_id IS NULL;
