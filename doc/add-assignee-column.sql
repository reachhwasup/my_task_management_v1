-- Migration: Add assignee_id column to tasks table
-- This allows for a single primary assignee (PIC) per task

ALTER TABLE tasks 
ADD COLUMN assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);

-- Update existing data if needed (optional)
-- This will set the assignee_id to the first user in task_assignees if one exists
UPDATE tasks t
SET assignee_id = ta.user_id
FROM task_assignees ta
WHERE t.id = ta.task_id
AND NOT EXISTS (
  SELECT 1 FROM task_assignees ta2 
  WHERE ta2.task_id = t.id 
  AND ta2.assigned_at < ta.assigned_at
);

COMMENT ON COLUMN tasks.assignee_id IS 'Primary assignee (PIC) for this task';
