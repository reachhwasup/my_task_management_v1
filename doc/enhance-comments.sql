-- Enhance comments table with edit tracking and attachments

-- 1. Add columns for edit tracking
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 2. Create table for comment reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- 👍 ❤️ 😄 🎉 👀 etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, reaction)
);

-- 3. Create storage bucket for comment attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-attachments', 'comment-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Set up storage policies
CREATE POLICY "Users can upload comment attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comment-attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own comment attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'comment-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view comment attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'comment-attachments');

CREATE POLICY "Users can delete their own comment attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comment-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);

-- Verify changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'comments' 
ORDER BY ordinal_position;
