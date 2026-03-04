-- Run this script in your Supabase SQL Editor
-- This adds the 'is_completed' boolean directly to the tasks table

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- If you have any tasks that are currently using the 'completed' status, 
-- you may want to port them over to this new boolean flag:
UPDATE tasks 
SET is_completed = TRUE 
WHERE status = 'completed';
