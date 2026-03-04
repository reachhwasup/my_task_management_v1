-- Create task_activity table for timeline tracking
-- This table logs all activities on a task (status changes, assignee changes, etc.)

CREATE TABLE IF NOT EXISTS task_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,         -- e.g., 'status_change', 'assignee_added', 'assignee_removed', 'subtask_added', 'subtask_completed', 'priority_change', 'due_date_change', 'description_updated', 'created'
  field TEXT,                   -- The field that changed (e.g., 'status', 'priority', 'due_date')
  old_value TEXT,               -- Previous value
  new_value TEXT,               -- New value
  metadata JSONB DEFAULT '{}',  -- Extra context (e.g., subtask title, assignee name)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by task
CREATE INDEX idx_task_activity_task_id ON task_activity(task_id);
CREATE INDEX idx_task_activity_created_at ON task_activity(created_at);

-- Enable RLS
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activity for tasks in their workspaces
CREATE POLICY "Users can view task activity for their workspace tasks"
ON task_activity FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE t.id = task_activity.task_id
    AND wm.user_id = auth.uid()
  )
);

-- Policy: Users can insert activity for tasks in their workspaces (editors/owners)
CREATE POLICY "Editors can insert task activity"
ON task_activity FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE t.id = task_activity.task_id
    AND wm.user_id = auth.uid()
    AND wm.permission IN ('editor', 'owner')
  )
);
