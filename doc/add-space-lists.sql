-- Migration: Allow lists directly under spaces (without requiring a folder)
-- Run this in your Supabase SQL Editor

-- 1. Add space_id column to lists table
ALTER TABLE lists ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

-- 2. Make folder_id nullable (it was NOT NULL before)
ALTER TABLE lists ALTER COLUMN folder_id DROP NOT NULL;

-- 3. Add index for space_id queries
CREATE INDEX IF NOT EXISTS idx_lists_space_id ON lists(space_id);

-- 4. Add constraint: a list must belong to either a folder OR a space (not both, not neither)
-- First drop if exists to make this idempotent
ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_must_have_parent;
ALTER TABLE lists ADD CONSTRAINT lists_must_have_parent 
  CHECK (folder_id IS NOT NULL OR space_id IS NOT NULL);

-- 5. Update RLS policies to also allow space-level lists

-- Drop existing policies so we can recreate them
DROP POLICY IF EXISTS "Users can view lists in their folders" ON lists;
DROP POLICY IF EXISTS "Owners and editors can create lists" ON lists;
DROP POLICY IF EXISTS "Owners and editors can update lists" ON lists;
DROP POLICY IF EXISTS "Owners can delete lists" ON lists;

-- SELECT: Users can view lists in folders OR spaces they have access to
CREATE POLICY "Users can view lists in their workspace"
  ON lists FOR SELECT
  USING (
    -- Folder-level lists
    folder_id IN (
      SELECT f.id 
      FROM folders f
      JOIN spaces s ON s.id = f.space_id
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
    )
    OR
    -- Space-level lists
    space_id IN (
      SELECT s.id
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- INSERT: Owners and editors can create lists
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
    OR
    space_id IN (
      SELECT s.id
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- UPDATE: Owners and editors can update lists
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
    OR
    space_id IN (
      SELECT s.id
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
      AND wm.permission IN ('owner', 'editor')
    )
  );

-- DELETE: Owners can delete lists
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
    OR
    space_id IN (
      SELECT s.id
      FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = auth.uid()
      AND wm.permission = 'owner'
    )
  );
