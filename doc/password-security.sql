-- Password Security Enhancement
-- 1. Password History Table (track last 20 passwords)
-- 2. Login Attempts Table (track failed login attempts)

-- Create password history table
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at DESC);

-- Create login attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);

-- Add account_locked_until and password tracking columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  locked_until TIMESTAMPTZ;
BEGIN
  SELECT account_locked_until INTO locked_until
  FROM profiles
  WHERE username = user_email;
  
  IF locked_until IS NOT NULL AND locked_until > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Function to check if password has expired (90 days)
CREATE OR REPLACE FUNCTION is_password_expired(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
  must_change BOOLEAN;
BEGIN
  SELECT password_expires_at, must_change_password INTO expires_at, must_change
  FROM profiles
  WHERE username = user_email;
  
  IF must_change = TRUE THEN
    RETURN TRUE;
  END IF;
  
  IF expires_at IS NOT NULL AND expires_at < NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Function to update password expiration after password change
CREATE OR REPLACE FUNCTION update_password_expiration(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET password_changed_at = NOW(),
      password_expires_at = NOW() + INTERVAL '90 days',
      must_change_password = FALSE
  WHERE username = user_email;
END;
$$;

-- Function to lock account after 5 failed attempts
CREATE OR REPLACE FUNCTION check_and_lock_account(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO failed_count
  FROM login_attempts
  WHERE email = user_email
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  -- Lock account for 30 minutes if 5 or more failed attempts
  IF failed_count >= 5 THEN
    UPDATE profiles
    SET account_locked_until = NOW() + INTERVAL '30 minutes'
    WHERE username = user_email;
  END IF;
END;
$$;

-- Function to clean old login attempts (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to clean old password history (keep only last 20 per user)
CREATE OR REPLACE FUNCTION cleanup_old_password_history()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM password_history
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM password_history
    ) sub
    WHERE rn > 20
  );
END;
$$;

-- RLS Policies
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own password history
CREATE POLICY "Users can view own password history"
  ON password_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all records
CREATE POLICY "Service role full access to password_history"
  ON password_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to login_attempts"
  ON login_attempts FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON password_history TO authenticated;
GRANT ALL ON login_attempts TO authenticated;
