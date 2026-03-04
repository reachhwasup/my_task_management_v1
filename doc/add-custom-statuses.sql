-- Migration: Add custom status support for workspaces
-- This allows workspaces to have their own custom status columns

-- First, we need to change task_status from ENUM to TEXT to allow custom values
ALTER TABLE tasks ALTER COLUMN status TYPE TEXT;

-- Drop the old ENUM type (if not used elsewhere)
-- DROP TYPE IF EXISTS task_status;

-- Create a table to store custom status columns per workspace
CREATE TABLE IF NOT EXISTS workspace_statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  status_key TEXT NOT NULL, -- e.g., 'todo', 'in_progress', 'done'
  status_label TEXT NOT NULL, -- e.g., 'To Do', 'In Progress', 'Done'
  color_class TEXT DEFAULT 'bg-gray-50', -- Tailwind color class
  icon_name TEXT DEFAULT 'circle', -- Icon name
  position INT NOT NULL, -- Order of columns
  is_system BOOLEAN DEFAULT false, -- Can't be deleted if true
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, status_key),
  UNIQUE(workspace_id, position)
);

-- Create index for better query performance
CREATE INDEX idx_workspace_statuses_workspace ON workspace_statuses(workspace_id);
CREATE INDEX idx_workspace_statuses_position ON workspace_statuses(workspace_id, position);

-- Insert default statuses for existing workspaces
INSERT INTO workspace_statuses (workspace_id, status_key, status_label, color_class, icon_name, position, is_system)
SELECT 
  id,
  'not_started',
  'To Do',
  'bg-gray-50',
  'circle',
  1,
  true
FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_statuses WHERE workspace_id = workspaces.id AND status_key = 'not_started'
);

INSERT INTO workspace_statuses (workspace_id, status_key, status_label, color_class, icon_name, position, is_system)
SELECT 
  id,
  'in_progress',
  'In Progress',
  'bg-blue-50',
  'clock',
  2,
  true
FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_statuses WHERE workspace_id = workspaces.id AND status_key = 'in_progress'
);

INSERT INTO workspace_statuses (workspace_id, status_key, status_label, color_class, icon_name, position, is_system)
SELECT 
  id,
  'completed',
  'Complete',
  'bg-green-50',
  'check-circle',
  3,
  true
FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_statuses WHERE workspace_id = workspaces.id AND status_key = 'completed'
);

COMMENT ON TABLE workspace_statuses IS 'Custom status columns per workspace for task boards';
