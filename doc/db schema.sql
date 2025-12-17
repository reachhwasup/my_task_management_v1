-- ==========================================
-- 1. ENUMS
-- ==========================================
CREATE TYPE system_role AS ENUM ('admin', 'user');
CREATE TYPE ws_permission AS ENUM ('viewer', 'editor', 'owner');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'pending', 'completed', 'canceled');
CREATE TYPE task_priority AS ENUM ('P1', 'P2', 'P3', 'P4');
CREATE TYPE notif_type AS ENUM ('mention', 'assignment', 'overdue', 'reply', 'invite');

-- ==========================================
-- 2. IDENTITY
-- ==========================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  avatar_url TEXT,
  role system_role DEFAULT 'user', 
  
  -- HR Info (Display Only)
  position TEXT, 
  
  -- Security
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  avatar_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. WORKSPACES (Self-Service Logic)
-- ==========================================
CREATE TABLE workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, 
  type TEXT CHECK (type IN ('official', 'personal')), -- 'official' just means Shared now
  owner_id UUID REFERENCES profiles(id) NOT NULL, -- MANDATORY: Creator is Owner
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access Control
CREATE TABLE workspace_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Logic: Owner = Admin of this board
  permission ws_permission DEFAULT 'viewer',
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ==========================================
-- 4. TASKS
-- ==========================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
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

-- Index for better query performance
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);

CREATE TABLE subtasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- ==========================================
-- 5. COLLABORATION
-- ==========================================
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  actor_id UUID REFERENCES profiles(id) NOT NULL,
  type notif_type NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. CRITICAL FUNCTION: CREATE WORKSPACE
-- ==========================================
-- This function ensures the Creator is automatically added as the Owner.
-- Call this from your Frontend using: supabase.rpc('create_workspace', { name: 'My New Board' })

CREATE OR REPLACE FUNCTION create_new_workspace(ws_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_ws_id UUID;
BEGIN
  -- 1. Create the Workspace
  INSERT INTO workspaces (name, type, owner_id)
  VALUES (ws_name, 'official', auth.uid())
  RETURNING id INTO new_ws_id;

  -- 2. Add the Creator as the OWNER in the members table
  INSERT INTO workspace_members (workspace_id, user_id, permission)
  VALUES (new_ws_id, auth.uid(), 'owner');

  RETURN new_ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. TRIGGERS (Automations)
-- ==========================================

-- Auto-Handle Task Dates
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

CREATE TRIGGER trig_task_dates BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION handle_task_dates();

-- Auto-Create Profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, firstname, lastname, role)
  VALUES (NEW.id, NEW.email, 'New', 'User', 'user');
  
  -- OPTIONAL: Auto-create a Personal Board for them immediately
  -- You can uncomment this if you want every new user to start with a board
  -- PERFORM create_new_workspace('My Personal Board');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();