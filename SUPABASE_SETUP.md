# Supabase Database Setup Instructions

## Your Supabase Project
- URL: https://vjcihaycpiokhfzbzdpw.supabase.co
- Status: ✅ Connected

## Step 1: Run Database Schema

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/vjcihaycpiokhfzbzdpw
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `doc/db schema.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)

## Step 2: Verify Tables Created

After running the schema, you should see these tables in the **Table Editor**:
- ✓ profiles
- ✓ password_history
- ✓ workspaces
- ✓ workspace_members
- ✓ tasks
- ✓ subtasks
- ✓ task_assignees
- ✓ comments
- ✓ notifications

## Step 3: Set Up Row Level Security (RLS)

You need to add RLS policies. Go to **SQL Editor** and run:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces: Users can only see workspaces they're members of
CREATE POLICY "Users can view their workspaces" ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace Members: Users can view members of their workspaces
CREATE POLICY "Users can view workspace members" ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only owners can insert new members
CREATE POLICY "Owners can invite members" ON workspace_members FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND permission = 'owner'
    )
  );

-- Tasks: Users can view tasks in their workspaces
CREATE POLICY "Users can view workspace tasks" ON tasks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Editors and owners can create tasks
CREATE POLICY "Editors can create tasks" ON tasks FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND permission IN ('editor', 'owner')
    )
  );

-- Editors and owners can update tasks
CREATE POLICY "Editors can update tasks" ON tasks FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND permission IN ('editor', 'owner')
    )
  );

-- Editors and owners can delete tasks
CREATE POLICY "Editors can delete tasks" ON tasks FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND permission IN ('editor', 'owner')
    )
  );

-- Subtasks: Same as tasks
CREATE POLICY "Users can view subtasks" ON subtasks FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Editors can manage subtasks" ON subtasks FOR ALL
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND permission IN ('editor', 'owner')
      )
    )
  );

-- Comments: All members can read, editors+ can create
CREATE POLICY "Users can view comments" ON comments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create comments" ON comments FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own comments" ON comments FOR DELETE
  USING (user_id = auth.uid());

-- Notifications: Users can only see their own
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications FOR INSERT
  WITH CHECK (true);
```

## Step 4: Test Your Setup

1. Restart your Next.js dev server:
   ```powershell
   npm run dev
   ```

2. Open http://localhost:3000

3. Sign up with a new account (this will auto-create a profile)

4. Try creating a workspace - you should become the owner automatically

## Common Issues

### Issue: "relation does not exist"
**Solution**: You haven't run the database schema yet. Go to Step 1.

### Issue: "new row violates row-level security policy"
**Solution**: You need to run the RLS policies from Step 3.

### Issue: "null value in column violates not-null constraint"
**Solution**: Make sure the `handle_new_user()` trigger is created. It should auto-create profiles on signup.

## Need Help?

Check the Supabase logs in your dashboard:
- Dashboard → Logs → Postgres Logs
- Look for any error messages when creating workspaces or tasks
