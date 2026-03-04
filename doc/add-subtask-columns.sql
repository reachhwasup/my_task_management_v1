-- Add assignee_id and due_date columns to subtasks table if they don't exist

-- Check if columns exist, if not add them
DO $$ 
BEGIN
    -- Add assignee_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subtasks' AND column_name = 'assignee_id'
    ) THEN
        ALTER TABLE subtasks 
        ADD COLUMN assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    -- Add due_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subtasks' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE subtasks 
        ADD COLUMN due_date DATE;
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subtasks'
ORDER BY ordinal_position;
