-- Add "Pending" status column for all workspaces

-- Step 1: First move completed to position 4 to make room
UPDATE workspace_statuses 
SET position = 4 
WHERE status_key = 'completed';

-- Step 2: Now add pending at position 3
INSERT INTO workspace_statuses (workspace_id, status_key, status_label, color_class, icon_name, position, is_system)
SELECT 
  id,
  'pending',
  'Pending',
  'bg-yellow-50',
  'alert-circle',
  3,
  true
FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_statuses WHERE workspace_id = workspaces.id AND status_key = 'pending'
);
