-- Query 1: Show all workspaces with their members
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  wm.user_id, 
  p.username, 
  p.firstname, 
  p.lastname,
  wm.permission
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN profiles p ON p.id = wm.user_id
ORDER BY w.name, p.username;

-- Query 2: Check if profiles exist for all users
SELECT 
  u.id,
  u.email,
  p.username,
  p.firstname,
  p.lastname,
  CASE WHEN p.id IS NULL THEN '❌ Missing Profile' ELSE '✅ Has Profile' END as status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC;
