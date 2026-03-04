-- First, verify your workspace IDs exist:
SELECT id, name, type FROM workspaces;

-- Copy the EXACT id from the results above (including all dashes)
-- Then use this template, replacing <workspace-id> with the actual UUID:

-- Insert spaces for "My Personal Board" workspace
INSERT INTO spaces (workspace_id, name, color, position) VALUES
('9b0b5204-9017-4481-849a-130b82adaee8', 'Personal Projects', 'purple', 0),
('9b0b5204-9017-4481-849a-130b82adaee8', 'Home Tasks', 'blue', 1),
('9b0b5204-9017-4481-849a-130b82adaee8', 'Goals & Planning', 'green', 2);

-- Insert spaces for "InfoSec" workspace
INSERT INTO spaces (workspace_id, name, color, position) VALUES
('e8450985-d5e9-4f5b-ae3e-d72b5cb64ba9', 'INFOSEC (GOV)', 'red', 0),
('e8450985-d5e9-4f5b-ae3e-d72b5cb64ba9', 'INFOSEC (SOC)', 'blue', 1),
('e8450985-d5e9-4f5b-ae3e-d72b5cb64ba9', 'CYBER SECURITY', 'red', 2),
('e8450985-d5e9-4f5b-ae3e-d72b5cb64ba9', 'Project / Assessment', 'indigo', 3);

-- OR just use the UI! Click the + button in the sidebar to create spaces dynamically.
