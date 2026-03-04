-- ==========================================
-- SAFE MIGRATION: Only creates missing objects
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Create ENUMS (only if they don't exist)
DO $$ BEGIN
  CREATE TYPE system_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_permission AS ENUM ('viewer', 'editor', 'owner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'pending', 'completed', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('P1', 'P2', 'P3', 'P4');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notif_type AS ENUM ('mention', 'assignment', 'overdue', 'reply', 'invite');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create PROFILES table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  avatar_url TEXT,
  role system_role DEFAULT 'user', 
  position TEXT, 
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  avatar_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create WORKSPACES tables
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, 
  type TEXT CHECK (type IN ('official', 'personal')),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  permission ws_permission DEFAULT 'viewer',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 4. Create TASKS tables
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT, 
  tags TEXT[],
  status task_status DEFAULT 'not_started',
  priority task_priority DEFAULT 'P3',
  progress_pct INT DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  due_date DATE,
  actual_start_at TIMESTAMPTZ, 
  completed_at TIMESTAMPTZ,    
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- 5. Create COLLABORATION tables
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  actor_id UUID REFERENCES profiles(id) NOT NULL,
  type notif_type NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create FUNCTION: create_new_workspace (safe version)
CREATE OR REPLACE FUNCTION create_new_workspace(ws_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_ws_id UUID;
BEGIN
  INSERT INTO workspaces (name, type, owner_id)
  VALUES (ws_name, 'official', auth.uid())
  RETURNING id INTO new_ws_id;

  INSERT INTO workspace_members (workspace_id, user_id, permission)
  VALUES (new_ws_id, auth.uid(), 'owner');

  RETURN new_ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create TRIGGERS

-- Trigger for task dates
CREATE OR REPLACE FUNCTION handle_task_dates() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    NEW.actual_start_at = NOW();
  END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
    NEW.progress_pct = 100;
  END IF;
  IF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_task_dates ON tasks;
CREATE TRIGGER trig_task_dates BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION handle_task_dates();

-- Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, firstname, lastname, role)
  VALUES (NEW.id, NEW.email, 'New', 'User', 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- SUCCESS! All tables and functions created.
-- Now run the RLS policies from SUPABASE_SETUP.md
-- ==========================================
