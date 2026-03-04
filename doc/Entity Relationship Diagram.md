# Entity Relationship Diagram (ERD)

**Project:** My Task Manager  
**Version:** 9.0  
**Date:** February 23, 2026  

---

## ER Diagram

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "creates"
    PROFILES ||--o{ PASSWORD_HISTORY : "has"
    PROFILES ||--o{ LOGIN_ATTEMPTS : "generates"
    PROFILES ||--o{ WORKSPACES : "owns"
    PROFILES ||--o{ WORKSPACE_MEMBERS : "joins"
    PROFILES ||--o{ TASKS : "creates"
    PROFILES ||--o{ TASKS : "assigned_to (primary)"
    PROFILES ||--o{ TASK_ASSIGNEES : "assigned_via"
    PROFILES ||--o{ SUBTASKS : "assigned_to"
    PROFILES ||--o{ COMMENTS : "writes"
    PROFILES ||--o{ COMMENT_REACTIONS : "reacts"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    PROFILES ||--o{ NOTIFICATIONS : "acts_as"
    PROFILES ||--o{ TASK_ACTIVITY : "performs"

    WORKSPACES ||--o{ WORKSPACE_MEMBERS : "has"
    WORKSPACES ||--o{ WORKSPACE_STATUSES : "defines"
    WORKSPACES ||--o{ SPACES : "contains"
    WORKSPACES ||--o{ TASKS : "contains"

    SPACES ||--o{ FOLDERS : "contains"
    SPACES ||--o{ LISTS : "has (direct)"
    SPACES ||--o{ TASKS : "belongs_to"

    FOLDERS ||--o{ LISTS : "contains"
    FOLDERS ||--o{ TASKS : "belongs_to"

    LISTS ||--o{ TASKS : "contains"

    TASKS ||--o{ TASK_ASSIGNEES : "has"
    TASKS ||--o{ SUBTASKS : "has"
    TASKS ||--o{ COMMENTS : "has"
    TASKS ||--o{ NOTIFICATIONS : "references"
    TASKS ||--o{ TASK_ACTIVITY : "logs"

    COMMENTS ||--o{ COMMENTS : "replies_to"
    COMMENTS ||--o{ COMMENT_REACTIONS : "has"
    COMMENTS ||--o{ NOTIFICATIONS : "references"

    PROFILES {
        uuid id PK "References auth.users(id)"
        text username UK "Email/username"
        text firstname "First name"
        text lastname "Last name"
        text avatar_url "Profile picture URL"
        system_role role "admin | user"
        text position "Job title"
        timestamptz password_changed_at "Last password change"
        int failed_attempts "Login attempt counter"
        timestamptz locked_until "Account lockout expiry"
        timestamptz avatar_updated_at
        timestamptz created_at
        timestamptz updated_at
    }

    PASSWORD_HISTORY {
        uuid id PK
        uuid user_id FK "References profiles(id)"
        text password_hash "Hashed password"
        timestamptz created_at
    }

    LOGIN_ATTEMPTS {
        uuid id PK
        text email "User email"
        boolean success "Login succeeded?"
        text ip_address "Client IP"
        timestamptz timestamp "Attempt time"
    }

    WORKSPACES {
        uuid id PK
        text name "Workspace display name"
        text type "official | personal"
        uuid owner_id FK "References profiles(id)"
        timestamptz created_at
    }

    WORKSPACE_MEMBERS {
        uuid id PK
        uuid workspace_id FK "References workspaces(id)"
        uuid user_id FK "References profiles(id)"
        ws_permission permission "owner | editor | viewer"
        timestamptz joined_at
    }

    WORKSPACE_STATUSES {
        uuid id PK
        uuid workspace_id FK "References workspaces(id)"
        text status_key "e.g. in_progress"
        text status_label "Display name"
        text color_class "Tailwind color class"
        text icon_name "Icon identifier"
        integer position "Display order"
        boolean is_system "System vs custom"
        timestamptz created_at
    }

    SPACES {
        uuid id PK
        uuid workspace_id FK "References workspaces(id)"
        text name
        text description
        text color "Default: blue"
        text icon
        uuid created_by FK "References auth.users(id)"
        integer position "Display order"
        timestamptz created_at
    }

    FOLDERS {
        uuid id PK
        uuid space_id FK "References spaces(id)"
        text name
        text description
        text color "Default: gray"
        text icon
        uuid created_by FK "References auth.users(id)"
        integer position "Display order"
        timestamptz created_at
    }

    LISTS {
        uuid id PK
        uuid folder_id FK "References folders(id) - nullable"
        uuid space_id FK "References spaces(id) - nullable"
        text name
        text description
        text color "Default: gray"
        text icon
        uuid created_by FK "References auth.users(id)"
        integer position "Display order"
        timestamptz created_at
    }

    TASKS {
        uuid id PK
        uuid workspace_id FK "References workspaces(id)"
        uuid list_id FK "References lists(id)"
        uuid space_id FK "References spaces(id)"
        uuid folder_id FK "References folders(id)"
        uuid created_by FK "References profiles(id)"
        uuid assignee_id FK "Primary assignee"
        text title
        text description
        text_array tags
        task_status status "not_started | in_progress | pending | completed | canceled"
        task_priority priority "P1 | P2 | P3 | P4"
        int progress_pct "0-100"
        date due_date
        timestamptz actual_start_at "Auto-set on status change"
        timestamptz completed_at "Auto-set on completion"
        timestamptz created_at
        timestamptz updated_at
    }

    TASK_ASSIGNEES {
        uuid task_id FK-PK "References tasks(id)"
        uuid user_id FK-PK "References profiles(id)"
        timestamptz assigned_at
    }

    SUBTASKS {
        uuid id PK
        uuid task_id FK "References tasks(id)"
        text title
        boolean is_completed "Default: false"
        uuid assignee_id FK "References profiles(id)"
        date due_date
        timestamptz created_at
    }

    COMMENTS {
        uuid id PK
        uuid task_id FK "References tasks(id)"
        uuid user_id FK "References profiles(id)"
        uuid parent_id FK "Self-ref for threading"
        text message
        timestamptz edited_at "Shows when edited"
        text attachment_url "File attachment"
        text attachment_name "Original filename"
        timestamptz created_at
    }

    COMMENT_REACTIONS {
        uuid id PK
        uuid comment_id FK "References comments(id)"
        uuid user_id FK "References profiles(id)"
        text reaction "Emoji character"
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK "Recipient - profiles(id)"
        uuid actor_id FK "Who triggered - profiles(id)"
        notif_type type "mention | assignment | overdue | reply | invite"
        uuid task_id FK "References tasks(id)"
        uuid comment_id FK "References comments(id)"
        boolean is_read "Default: false"
        timestamptz created_at
    }

    TASK_ACTIVITY {
        uuid id PK
        uuid task_id FK "References tasks(id)"
        uuid user_id FK "References auth.users(id)"
        text action "status_change | priority_change | etc."
        text field "Which field changed"
        text old_value
        text new_value
        jsonb metadata "Additional context"
        timestamptz created_at
    }
```

---

## Entity Summary

| # | Entity | Purpose | Key Relationships |
|---|--------|---------|-------------------|
| 1 | **profiles** | User accounts & identity | Links to `auth.users`, owns workspaces, assigned tasks |
| 2 | **password_history** | Stores last 20 password hashes | Belongs to `profiles` |
| 3 | **login_attempts** | Tracks login success/failure | Linked by email to `profiles` |
| 4 | **workspaces** | Top-level organization unit | Owned by `profiles`, contains spaces, tasks |
| 5 | **workspace_members** | Access control (many-to-many) | Links `profiles` ↔ `workspaces` with permission level |
| 6 | **workspace_statuses** | Custom Kanban column definitions | Belongs to `workspaces` |
| 7 | **spaces** | Project areas within a workspace | Belongs to `workspaces`, contains folders & lists |
| 8 | **folders** | Optional grouping within spaces | Belongs to `spaces`, contains lists |
| 9 | **lists** | Task collections | Belongs to `folders` OR directly to `spaces` |
| 10 | **tasks** | Individual work items | Belongs to `workspaces`/`lists`, has subtasks, comments |
| 11 | **task_assignees** | Multiple assignees per task | Links `tasks` ↔ `profiles` (many-to-many) |
| 12 | **subtasks** | Checklist items within a task | Belongs to `tasks`, optionally assigned to `profiles` |
| 13 | **comments** | Threaded discussions on tasks | Belongs to `tasks`, self-referencing for replies |
| 14 | **comment_reactions** | Emoji reactions on comments | Links `comments` ↔ `profiles` |
| 15 | **notifications** | Alert system for users | References `profiles`, `tasks`, `comments` |
| 16 | **task_activity** | Change audit trail for tasks | Belongs to `tasks`, performed by user |

---

## Relationship Details

### Hierarchy Chain (1-to-Many)
```
Workspace → Space → Folder (optional) → List → Task → Subtask
```

### Many-to-Many Relationships

| Relationship | Junction Table | Purpose |
|-------------|----------------|---------|
| Profiles ↔ Workspaces | `workspace_members` | Controls who can access which workspace with what permission |
| Tasks ↔ Profiles | `task_assignees` | Allows multiple people to be assigned to one task |
| Comments ↔ Profiles (reactions) | `comment_reactions` | Tracks which users reacted with which emoji |

### Self-Referencing

| Table | Column | Purpose |
|-------|--------|---------|
| `comments` | `parent_id → comments.id` | Enables threaded comment replies |

### Flexible Parent (Polymorphic)

| Table | Condition | Parent |
|-------|-----------|--------|
| `lists` | `folder_id IS NOT NULL` | Belongs to a **Folder** |
| `lists` | `space_id IS NOT NULL, folder_id IS NULL` | Belongs directly to a **Space** |

---

## Enum Types

| Enum | Values | Used In |
|------|--------|---------|
| `system_role` | `admin`, `user` | `profiles.role` |
| `ws_permission` | `viewer`, `editor`, `owner` | `workspace_members.permission` |
| `task_status` | `not_started`, `in_progress`, `pending`, `completed`, `canceled` | `tasks.status` |
| `task_priority` | `P1`, `P2`, `P3`, `P4` | `tasks.priority` |
| `notif_type` | `mention`, `assignment`, `overdue`, `reply`, `invite` | `notifications.type` |
