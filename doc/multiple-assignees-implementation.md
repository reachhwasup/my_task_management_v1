# Multiple Assignees Implementation

## Overview
Enhanced the task management system to support **multiple assignees per task** instead of just one.

## Changes Made

### 1. Database Schema
The system now uses the existing `task_assignees` table that was already in the schema:

```sql
CREATE TABLE task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);
```

**Note:** The `assignee_id` column in the `tasks` table is kept for backward compatibility and stores the "primary" assignee (first one selected).

### 2. Frontend Components Updated

#### NewTaskModal.tsx
- **Before:** Single assignee dropdown (select one)
- **After:** Multi-select checkbox list allowing multiple assignees
- Shows count of selected assignees
- Inserts records into `task_assignees` table when creating tasks

#### TaskDetailsModal.tsx
- **Before:** Single assignee dropdown
- **After:** Scrollable checkbox list for multiple assignees
- Shows count: "Assignees (3)"
- Max height with scroll for many members
- Updates both `tasks.assignee_id` (primary) and `task_assignees` table

#### TaskBoard.tsx
- **Before:** Shows single assignee badge
- **After:** 
  - Shows up to 2 assignee badges
  - Shows "+X" badge if more than 2 assignees
  - Maintains compact card design

#### page.tsx (Dashboard)
- Updated Task interface to include `task_assignees` array
- Updated data fetching to join with `task_assignees` table
- Fetches assignee profiles for display

### 3. User Experience

#### Creating a Task
1. Open "New Task" modal
2. Fill in task details
3. Select multiple assignees by checking boxes
4. See count: "3 assignees selected"
5. Click "Create Task"

#### Editing Assignees
1. Open task details modal
2. See "Assignees (3)" with scrollable list
3. Check/uncheck boxes to add/remove assignees
4. Changes saved when clicking "Save"

#### Viewing Tasks on Board
- Cards show first 2 assignees as badges
- If more than 2: Shows "+1", "+2", etc.
- Hover/click task for full details

### 4. Data Flow

```
Create Task:
1. Insert task → tasks table
2. Insert assignees → task_assignees table
3. Set tasks.assignee_id = first assignee (primary)

Update Task:
1. Update task details → tasks table
2. Delete old assignees → task_assignees table
3. Insert new assignees → task_assignees table
4. Set tasks.assignee_id = first assignee (primary)

Display Task:
1. Fetch task with JOIN on task_assignees
2. Show assignees from task_assignees array
3. Fallback to assignee if task_assignees empty
```

### 5. Backward Compatibility

The system maintains backward compatibility:
- Old tasks with only `assignee_id` still display correctly
- New tasks populate both `assignee_id` (primary) and `task_assignees`
- Filtering by assignee still works

### 6. UI Screenshots (Conceptual)

**New Task Modal:**
```
┌─────────────────────────────┐
│ Assignees (Select Multiple) │
├─────────────────────────────┤
│ ☑ john.doe                  │
│ ☑ jane.smith                │
│ ☐ bob.jones                 │
│ ☐ alice.wang                │
└─────────────────────────────┘
2 assignees selected
```

**Task Card:**
```
┌───────────────────────────┐
│ 🔴 Fix Database Bug       │
│                           │
│ [👤 john.doe] [👤 jane]   │
│ [+2]                      │
│                           │
│ ☑ 3/5                     │
└───────────────────────────┘
```

**Task Details Modal:**
```
┌─────────────────────────────┐
│ Assignees (4)              │
├─────────────────────────────┤
│ ☑ john.doe                  │
│ ☑ jane.smith                │
│ ☑ bob.jones                 │
│ ☑ alice.wang                │
└─────────────────────────────┘
```

## Testing Checklist

- [x] Create task with no assignees
- [x] Create task with 1 assignee
- [x] Create task with multiple assignees (2-5)
- [x] Edit task to add assignees
- [x] Edit task to remove assignees
- [x] View task card with multiple assignees
- [x] Verify task_assignees table populated correctly
- [x] Verify assignee_id set to first assignee
- [x] Check backward compatibility with old tasks
- [x] Test with read-only permission (viewer)

## Benefits

1. **Collaboration:** Multiple people can be assigned to one task
2. **Visibility:** Everyone knows who's working on what
3. **Flexibility:** Easy to add/remove team members
4. **Backward Compatible:** Old data still works
5. **Scalable UI:** Shows "+X" for many assignees

## Future Enhancements

- Add role distinction (primary vs secondary assignees)
- Email notifications to all assignees
- Filter tasks by "any of selected assignees"
- Show assignee avatars instead of just names
- Drag-and-drop to reassign tasks
- Task assignment history/audit trail
