# Functional Requirements Document (FRD)

**Project:** My Task Manager - Internal Enterprise Task System  
**Version:** 7.0 (Self-Service Model)  
**Date:** February 9, 2026  
**Status:** ✅ Finalized  
**Document Owner:** Project Team  
**Scope:** Organization-wide Multi-Department Task Management

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 11, 2025 | Team | Initial draft |
| 2.0 | Dec 15, 2025 | Team | Added password security |
| 3.0 | Dec 20, 2025 | Team | Added collaboration features |
| 7.0 | Feb 9, 2026 | Team | **Finalized - Production Ready** |

---

## 1. Executive Summary

### 1.1 Project Objective
Develop a secure, collaborative task management platform where teams can self-organize without IT intervention, enabling any employee to create workspaces, manage projects, and collaborate with colleagues in a structured, permission-based environment.

### 1.2 Core Philosophy
**"Self-Service Collaboration"** - Empowering teams to organize themselves while maintaining enterprise-grade security and governance.

### 1.3 Key Business Benefits
- ✅ **Zero IT Bottleneck**: Teams create and manage their own workspaces instantly
- ✅ **Flexible Hierarchy**: 5-level organizational structure for maximum flexibility
- ✅ **Granular Permissions**: Role-based access control at workspace level
- ✅ **Enhanced Collaboration**: Comments, mentions, reactions, file attachments
- ✅ **Enterprise Security**: Password policies, account lockout, audit trails
- ✅ **Customizable Workflows**: Custom status columns per workspace
- ✅ **Real-time Collaboration**: Multiple users can work simultaneously

---

## 2. Organization & Access Control

### 2.1 Two-Layer Security Model

#### Layer 1: System Role (Global)

| Role | Assignment | Scope | Capabilities |
|------|-----------|-------|--------------|
| **System Admin** | Manually assigned | Global | • Server/database maintenance<br>• User management<br>• System configuration<br>• Audit log access |
| **Standard User** | Default for all users | Global | • Platform usage<br>• Workspace creation<br>• Profile management<br>• Notification preferences |

#### Layer 2: Workspace Permission (Contextual)

| Permission | Assignment | Removal | Primary Role |
|-----------|-----------|---------|--------------|
| **Owner** | Auto-assigned to workspace creator | Cannot be removed | Workspace administrator with full control |
| **Editor** | Invited by Owner | Owner only | Active contributor and collaborator |
| **Viewer** | Invited by Owner | Owner only | Read-only monitoring and oversight |

### 2.2 Workspace Management

#### Workspace Creation (Self-Service)
- **Who:** Any logged-in standard user
- **Process:** Click "Create New Workspace" → Enter name → Auto-assigned as Owner
- **Instant:** No approval required, workspace created immediately
- **Limit:** Unlimited workspaces per user

#### Workspace Types
| Type | Purpose | Auto-Creation |
|------|---------|---------------|
| **Personal** | Private sandbox for individual use | Created automatically on user signup |
| **Collaborative** | Shared spaces for team projects | Created on-demand by any user |

---

## 3. Hierarchical Organization Structure

### 3.1 5-Level Hierarchy

```
WORKSPACE (Top Level)
  └─ SPACE (Project Area/Department)
      └─ FOLDER (Year/Quarter/Category)
          └─ LIST (Task Collection)
              └─ TASK (Individual Work Item)
                  └─ SUBTASK (Checklist Item)
```

### 3.2 Entity Descriptions

| Level | Description | Who Can Create | Example |
|-------|-------------|----------------|---------|
| **Workspace** | Top-level organization unit | Any user | "Marketing Department", "Q1 2026 Campaign" |
| **Space** | Project area or team grouping | Owner, Editor | "Social Media Team", "Website Redesign" |
| **Folder** | Time period or category | Owner, Editor | "2026", "High Priority", "Client Projects" |
| **List** | Named collection of tasks | Owner, Editor | "Backlog", "To Do", "Sprint 1" |
| **Task** | Individual work item | Owner, Editor | "Design landing page", "Write blog post" |
| **Subtask** | Checklist item within task | Owner, Editor | "Create wireframe", "Get approval" |

---

## 4. Functional Requirements by Feature Area

### 4.1 User Authentication & Security

#### FR-AUTH-001: User Registration
- **Description:** New users can create accounts with email and password
- **Validation:** 
  - Email must be unique and valid format
  - Password minimum 12 characters
  - Automatic profile creation on successful signup
- **Post-Registration:** Personal workspace automatically created
- **Priority:** P1 (Critical)

#### FR-AUTH-002: User Login
- **Description:** Users authenticate with email and password
- **Failed Attempts:** Maximum 5 attempts within 15 minutes
- **Account Lockout:** 30 minutes after 5 failed attempts
- **Attempt Counter:** Shows remaining attempts to user
- **Auto-Unlock:** Account unlocks automatically after 30 minutes
- **Priority:** P1 (Critical)

#### FR-AUTH-003: Password Security Requirements
- **Minimum Length:** 12 characters (enforced)
- **Recommendations:** Uppercase, lowercase, numbers (suggested, not enforced)
- **Expiration:** 90 days from creation/change date
- **Forced Change:** Users must change expired passwords before system access
- **History Tracking:** System prevents reuse of last 20 passwords
- **Priority:** P1 (Critical)

#### FR-AUTH-004: Password Reset Flow
- **Trigger:** "Forgot Password" link on login page
- **Process:** 
  1. User enters email address
  2. Supabase sends secure reset link (if email exists)
  3. User clicks link (valid for 1 hour)
  4. User enters new password
  5. Link invalidated after single use
- **Security:** Same message for valid/invalid emails (no user enumeration)
- **Priority:** P1 (Critical)

#### FR-AUTH-005: Session Management
- **Session Duration:** Configurable via Supabase Auth settings
- **Auto Logout:** After password expiration or account lockout
- **Token Refresh:** Automatic token refresh for active sessions
- **Priority:** P2 (High)

### 4.2 Workspace Management

#### FR-WS-001: Create Workspace
- **Who:** Any standard user
- **Process:** 
  1. Click "Create New Workspace"
  2. Enter workspace name (required, 3-100 characters)
  3. System creates workspace and assigns creator as Owner
- **Auto-Created Items:** Default "Personal Space 2026" space
- **Validation:** Workspace name must be unique per user
- **Priority:** P1 (Critical)

#### FR-WS-002: Invite Members
- **Who:** Workspace Owner only
- **Process:**
  1. Owner clicks "Invite Members"
  2. Enters email address of existing user
  3. Selects permission level (Editor or Viewer)
  4. System creates workspace_member record
  5. Invitee receives notification
- **Validation:** Email must match existing user account
- **Priority:** P1 (Critical)

#### FR-WS-003: Manage Member Permissions
- **Who:** Workspace Owner only
- **Actions:**
  - Change member permission (Editor ↔ Viewer)
  - Remove member from workspace
- **Restriction:** Cannot change or remove Owner
- **Effect:** Immediate access changes
- **Priority:** P1 (Critical)

#### FR-WS-004: Rename Workspace
- **Who:** Workspace Owner only
- **Validation:** Name required, 3-100 characters
- **Effect:** Updates workspace name everywhere
- **Priority:** P2 (High)

#### FR-WS-005: Delete Workspace
- **Who:** Workspace Owner only
- **Confirmation:** Require confirmation dialog
- **Cascade:** Deletes all spaces, folders, lists, tasks, subtasks, comments
- **Warning:** Show count of items to be deleted
- **Irreversible:** No undo functionality
- **Priority:** P2 (High)

### 4.3 Kanban Board & Status Management

#### FR-KANBAN-001: View Kanban Board
- **Who:** All workspace members
- **Display:** Column-based view with status columns
- **System Columns:** Not Started, In Progress, Pending, Completed (cannot be deleted)
- **Custom Columns:** User-created columns appear in custom order
- **Priority:** P1 (Critical)

#### FR-KANBAN-002: Create Custom Status Column
- **Who:** Owner, Editor
- **Inputs:**
  - Status name (required, 2-50 characters)
  - Icon selection (7 options: Circle, Clock, Check, Alert, Lightning, Target, Flag)
  - Color selection (8 options: Gray, Blue, Green, Yellow, Red, Purple, Pink, Indigo)
- **Position:** Inserted between system columns (after In Progress, before Completed)
- **Limit:** Unlimited custom columns per workspace
- **Priority:** P1 (Critical)

#### FR-KANBAN-003: Rename Status Column
- **Who:** Owner, Editor
- **Target:** Custom columns only (system columns cannot be renamed)
- **Validation:** Name required, 2-50 characters
- **Priority:** P2 (High)

#### FR-KANBAN-004: Reorder Status Columns
- **Who:** Owner, Editor
- **Method:** Drag and drop column headers
- **Constraint:** System columns maintain relative order
- **Effect:** Updates position field, all users see new order
- **Priority:** P2 (High)

#### FR-KANBAN-005: Delete Custom Status Column
- **Who:** Owner only
- **Target:** Custom columns only
- **Validation:** Cannot delete if tasks exist in that status
- **Alternative:** Require moving tasks to another status first
- **Priority:** P2 (High)

### 4.4 Task Management

#### FR-TASK-001: Create Task
- **Who:** Owner, Editor
- **Required Fields:**
  - Title (3-200 characters)
  - Workspace (auto-selected)
- **Optional Fields:**
  - Description (rich text, up to 5000 characters)
  - List assignment
  - Assignees (multiple)
  - Priority (P1-P4)
  - Due date
  - Tags (array)
- **Default Values:**
  - Status: Not Started
  - Priority: P3
  - Progress: 0%
- **Priority:** P1 (Critical)

#### FR-TASK-002: Edit Task Details
- **Who:** Owner, Editor
- **Editable Fields:** All task properties
- **Auto-Updates:**
  - updated_at timestamp on any change
  - progress_pct recalculated when subtasks change
- **Validation:** Title required on every save
- **Priority:** P1 (Critical)

#### FR-TASK-003: Change Task Status
- **Who:** Owner, Editor
- **Method:** 
  - Drag task to different column
  - OR select status from task details modal
- **Auto-Timestamps:**
  - actual_start_at: Set when status changes TO "In Progress" (first time only)
  - completed_at: Set when status changes TO "Completed"
- **Priority:** P1 (Critical)

#### FR-TASK-004: Assign Task (Multiple Assignees)
- **Who:** Owner, Editor
- **Selection:** Multi-select dropdown of workspace members
- **Storage:** Creates task_assignees records (many-to-many)
- **Primary Assignee:** First assignee listed
- **Notifications:** All assignees receive notification
- **Unassign:** Can remove individual assignees
- **Priority:** P1 (Critical)

#### FR-TASK-005: Set Priority
- **Who:** Owner, Editor
- **Options:** P1 (Highest), P2 (High), P3 (Normal), P4 (Low)
- **Visual:** Color-coded badges (P1=red, P2=orange, P3=blue, P4=gray)
- **Default:** P3 (Normal)
- **Priority:** P2 (High)

#### FR-TASK-006: Set Due Date
- **Who:** Owner, Editor
- **Input:** Date picker (calendar UI)
- **Validation:** Due date can be past, present, or future
- **Visual Indicator:** 
  - Red text if overdue
  - Yellow text if due within 3 days
- **Notifications:** Overdue tasks generate notifications daily
- **Priority:** P2 (High)

#### FR-TASK-007: View Task Details
- **Who:** All workspace members
- **Display:** Modal dialog with all task information
- **Sections:**
  - Task metadata (title, status, priority, dates)
  - Description
  - Assignees
  - Subtasks list
  - Progress bar
  - Comments section
  - Attachments
- **Priority:** P1 (Critical)

#### FR-TASK-008: Delete Task
- **Who:** Owner, Editor
- **Confirmation:** Require confirmation dialog
- **Cascade:** Deletes all subtasks and comments
- **Warning:** Show count of items to be deleted
- **Priority:** P2 (High)

### 4.5 Subtask Management

#### FR-SUBTASK-001: Create Subtask
- **Who:** Owner, Editor
- **Location:** Within task details modal
- **Required:** Subtask title (3-100 characters)
- **Optional:** Assignee (single user)
- **Default:** is_completed = false
- **Priority:** P1 (Critical)

#### FR-SUBTASK-002: Complete/Uncomplete Subtask
- **Who:** Owner, Editor
- **Method:** Toggle checkbox
- **Auto-Update:** Recalculates parent task progress_pct
- **Formula:** progress_pct = (completed_subtasks / total_subtasks) × 100
- **Priority:** P1 (Critical)

#### FR-SUBTASK-003: Delete Subtask
- **Who:** Owner, Editor
- **Effect:** Updates parent task progress
- **No Confirmation:** Direct deletion for subtasks
- **Priority:** P2 (High)

### 4.6 Space, Folder, and List Management

#### FR-SFL-001: Create Space
- **Who:** Owner, Editor
- **Required:** Space name (3-100 characters)
- **Optional:** Color, Icon
- **Parent:** Workspace
- **Priority:** P1 (Critical)

#### FR-SFL-002: Create Folder
- **Who:** Owner, Editor
- **Required:** Folder name (3-100 characters)
- **Parent:** Space
- **Priority:** P2 (High)

#### FR-SFL-003: Create List
- **Who:** Owner, Editor
- **Required:** List name (3-100 characters)
- **Parent:** Folder (or direct to Space if no folder)
- **Priority:** P1 (Critical)

#### FR-SFL-004: Edit Space/Folder/List
- **Who:** Owner, Editor
- **Editable:** Name, color, icon
- **Priority:** P2 (High)

#### FR-SFL-005: Delete Space/Folder/List
- **Who:** Owner only
- **Confirmation:** Required
- **Cascade:** Shows count of child items that will be deleted
- **Priority:** P2 (High)

### 4.7 Collaboration - Comments

#### FR-COMMENT-001: Add Comment
- **Who:** Owner, Editor
- **Location:** Task details modal
- **Required:** Comment text (1-5000 characters)
- **Optional:** File attachment
- **Auto-Set:** user_id, created_at
- **Priority:** P1 (Critical)

#### FR-COMMENT-002: Threaded Replies
- **Who:** Owner, Editor
- **Method:** Click "Reply" on any comment
- **Storage:** parent_id references original comment
- **Display:** Indented under parent comment
- **Priority:** P1 (Critical)

#### FR-COMMENT-003: Edit Own Comment
- **Who:** Comment author only
- **Time Limit:** No time limit
- **Indicator:** Shows "(edited)" label
- **Timestamp:** edited_at field updated
- **Priority:** P2 (High)

#### FR-COMMENT-004: Delete Own Comment
- **Who:** Comment author only
- **Effect:** Removes comment and all child replies
- **Confirmation:** Required if comment has replies
- **Priority:** P2 (High)

### 4.8 Collaboration - Mentions

#### FR-MENTION-001: @Mention Users
- **Who:** Owner, Editor
- **Trigger:** Type "@" in comment field
- **Autocomplete:** Shows dropdown of workspace members as you type
- **Display:** Member name + avatar
- **Search:** Filters by firstname, lastname, username
- **Priority:** P1 (Critical)

#### FR-MENTION-002: Mention Notifications
- **Trigger:** Comment containing @mention is posted
- **Recipients:** All mentioned users
- **Type:** "mention" notification
- **Content:** Link to task + comment preview
- **Priority:** P1 (Critical)

### 4.9 Collaboration - Reactions

#### FR-REACTION-001: Add Emoji Reaction
- **Who:** Owner, Editor
- **Emojis:** 👍 ❤️ 😄 🎉 👀 🚀
- **Method:** Click emoji button under comment
- **Storage:** Creates comment_reactions record
- **Unique:** One reaction type per user per comment
- **Priority:** P2 (High)

#### FR-REACTION-002: Remove Reaction
- **Who:** User who added the reaction
- **Method:** Click same emoji again (toggle)
- **Effect:** Deletes comment_reactions record
- **Priority:** P2 (High)

#### FR-REACTION-003: View Reaction Counts
- **Who:** All workspace members
- **Display:** Shows count for each emoji type
- **Highlight:** User's own reactions visually distinguished
- **Priority:** P2 (High)

### 4.10 Collaboration - File Attachments

#### FR-ATTACH-001: Upload File to Comment
- **Who:** Owner, Editor
- **Location:** Comment input area
- **File Types:** All types allowed (no restriction)
- **Size Limit:** Configured in Supabase Storage (default 50MB)
- **Storage Path:** `comment-attachments/{user_id}/{filename}`
- **Preview:** Shows filename before posting comment
- **Priority:** P2 (High)

#### FR-ATTACH-002: Download Attachment
- **Who:** All workspace members
- **Method:** Click attachment name
- **Security:** Authenticated access via Supabase Storage
- **Priority:** P2 (High)

### 4.11 Notifications

#### FR-NOTIF-001: Notification Types
| Type | Trigger | Recipients |
|------|---------|-----------|
| **mention** | User @mentioned in comment | Mentioned user |
| **assignment** | User assigned to task | Assigned user(s) |
| **overdue** | Task past due date | All assignees |
| **reply** | Reply to user's comment | Original comment author |
| **invite** | Added to workspace | Invited user |

**Priority:** P1 (Critical)

#### FR-NOTIF-002: Notification Display
- **Location:** Notification panel (accessible from header)
- **Badge:** Unread count on notification icon
- **Content:** Actor name, action, task/workspace name
- **Link:** Click notification → navigate to relevant task
- **Priority:** P1 (Critical)

#### FR-NOTIF-003: Mark as Read
- **Who:** Notification recipient
- **Method:** Click notification OR click "Mark all as read"
- **Effect:** Updates is_read to true, removes from unread count
- **Priority:** P1 (Critical)

### 4.12 User Profile Management

#### FR-PROFILE-001: View Own Profile
- **Who:** All users
- **Display:** Profile settings modal
- **Fields:** Firstname, Lastname, Username (email), Avatar, Position
- **Priority:** P2 (High)

#### FR-PROFILE-002: Edit Profile
- **Who:** Own profile only
- **Editable:** Firstname, Lastname, Avatar, Position
- **Non-Editable:** Email/username (managed via Supabase Auth)
- **Priority:** P2 (High)

#### FR-PROFILE-003: Upload Avatar
- **Who:** All users
- **File Types:** Image files (jpg, png, gif)
- **Size Limit:** 5MB
- **Storage:** Supabase Storage bucket `avatars`
- **Fallback:** Shows initials if no avatar
- **Priority:** P3 (Medium)

### 4.13 Search & Filtering (Future Enhancement)

#### FR-SEARCH-001: Search Tasks
- **Who:** All workspace members
- **Scope:** Current workspace only
- **Search Fields:** Title, description, tags
- **Priority:** P3 (Medium) - Not in current version

#### FR-FILTER-001: Filter Tasks
- **Criteria:** Status, Priority, Assignee, Due Date, Tags
- **Combination:** Multiple filters (AND logic)
- **Priority:** P3 (Medium) - Not in current version

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Requirement | Priority |
|--------|-------------|----------|
| **Page Load Time** | < 2 seconds on broadband | P1 |
| **API Response Time** | < 500ms for 95% of requests | P1 |
| **Database Queries** | Optimized with indexes on foreign keys | P1 |
| **Concurrent Users** | Support 100+ simultaneous users | P2 |
| **Real-time Updates** | Notification delivery within 5 seconds | P2 |

### 5.2 Security

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Data Encryption** | TLS/SSL for all connections | P1 |
| **Password Storage** | Bcrypt hashing via Supabase Auth | P1 |
| **Row-Level Security** | PostgreSQL RLS on all tables | P1 |
| **Session Tokens** | JWT with configurable expiration | P1 |
| **File Upload Security** | Authenticated access only | P1 |
| **SQL Injection Prevention** | Parameterized queries only | P1 |
| **XSS Prevention** | Input sanitization | P1 |

### 5.3 Usability

| Requirement | Description | Priority |
|-------------|-------------|----------|
| **Responsive Design** | Works on desktop, tablet, mobile | P1 |
| **Browser Support** | Chrome, Firefox, Safari, Edge (latest 2 versions) | P1 |
| **Accessibility** | WCAG 2.1 Level AA compliance | P2 |
| **Error Messages** | Clear, actionable error messages | P1 |
| **Loading States** | Visual feedback during operations | P1 |

### 5.4 Reliability

| Requirement | Target | Priority |
|-------------|--------|----------|
| **Uptime** | 99.5% availability | P1 |
| **Data Backup** | Daily automated backups (Supabase) | P1 |
| **Error Recovery** | Graceful degradation on failures | P2 |
| **Data Integrity** | Foreign key constraints enforced | P1 |

### 5.5 Scalability

| Aspect | Approach | Priority |
|--------|----------|----------|
| **Database** | PostgreSQL with connection pooling | P1 |
| **File Storage** | Supabase Storage (CDN-backed) | P1 |
| **Horizontal Scaling** | Stateless Next.js app (supports multiple instances) | P2 |

---

## 6. Data Validation Rules

### 6.1 Field Validations

| Field | Min Length | Max Length | Format | Required |
|-------|-----------|-----------|--------|----------|
| **Password** | 12 chars | 72 chars | Any characters | ✓ |
| **Email** | 3 chars | 255 chars | Valid email format | ✓ |
| **Firstname** | 2 chars | 50 chars | Letters, spaces, hyphens | ✓ |
| **Lastname** | 2 chars | 50 chars | Letters, spaces, hyphens | ✓ |
| **Workspace Name** | 3 chars | 100 chars | Any characters | ✓ |
| **Task Title** | 3 chars | 200 chars | Any characters | ✓ |
| **Task Description** | 0 chars | 5000 chars | Rich text | ✗ |
| **Comment** | 1 char | 5000 chars | Any characters | ✓ |
| **Subtask Title** | 3 chars | 100 chars | Any characters | ✓ |
| **Status Name** | 2 chars | 50 chars | Any characters | ✓ |

### 6.2 Business Logic Validations

| Rule | Validation | Error Message |
|------|-----------|---------------|
| **Workspace Creator** | User must be authenticated | "Please log in to create a workspace" |
| **Invite Member** | Only Owner can invite | "Only workspace owners can invite members" |
| **Email Exists** | User email must exist in system | "User not found" |
| **Delete Status** | No tasks in that status | "Cannot delete status with existing tasks" |
| **Password Reuse** | Not in last 20 passwords | "Password has been used recently" |
| **Account Locked** | Check locked_until timestamp | "Account locked until {timestamp}" |
| **Password Expired** | Check password_expires_at | "Password has expired, please reset" |

---

## 7. User Interface Requirements

### 7.1 Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                                     │
│  • Logo                                                     │
│  • Workspace Switcher                                      │
│  • Notifications Icon (with badge)                         │
│  • Profile Dropdown                                        │
└─────────────────────────────────────────────────────────────┘
┌──────────┬──────────────────────────────────────────────────┐
│          │                                                  │
│ Sidebar  │  Main Content Area                             │
│          │                                                  │
│ • Home   │  • Kanban Board (if list selected)            │
│ • Spaces │  • Space Overview (if space selected)          │
│ • Lists  │  • Task Details Modal (when task opened)       │
│ • Create │                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### 7.2 Modal Requirements

| Modal | Trigger | Required Fields | Actions |
|-------|---------|----------------|---------|
| **Create Workspace** | "+ Create Workspace" | Workspace name | Create, Cancel |
| **Invite Members** | "Invite Members" | Email, Permission | Send Invite, Cancel |
| **Task Details** | Click task card | None (view mode) | Edit, Delete, Close |
| **New Task** | "+ New Task" | Title | Create, Cancel |
| **Profile Settings** | Profile icon | None | Save, Cancel |
| **Create Space** | "+ New Space" | Space name | Create, Cancel |
| **Create Folder** | "+ New Folder" | Folder name | Create, Cancel |
| **Create List** | "+ New List" | List name | Create, Cancel |

### 7.3 Visual Feedback Requirements

| Event | Visual Feedback | Duration |
|-------|----------------|----------|
| **Task Created** | Success toast message | 3 seconds |
| **Task Moved** | Smooth drag animation | Instant |
| **Comment Posted** | Comment appears immediately | Instant |
| **File Uploading** | Progress spinner | Until complete |
| **Data Loading** | Skeleton screens OR loading spinner | Until loaded |
| **Error Occurred** | Error toast message (red) | 5 seconds |
| **Validation Error** | Red border on field + error text | Until fixed |

---

## 8. Integration Requirements

### 8.1 Supabase Integration

| Service | Usage | Configuration |
|---------|-------|---------------|
| **Supabase Auth** | User authentication, password reset | Email provider configured |
| **Supabase Database** | PostgreSQL data storage | RLS enabled on all tables |
| **Supabase Storage** | File uploads (avatars, attachments) | Public bucket for avatars, authenticated for attachments |
| **Supabase Realtime** | (Optional) Real-time notifications | Not implemented in current version |

### 8.2 External Services

| Service | Purpose | Status |
|---------|---------|--------|
| **Email Service** | Password reset, notifications | Supabase Auth email (configured) |
| **CDN** | Static asset delivery | Vercel CDN (if deployed to Vercel) |

---

## 9. Success Metrics & KPIs

### 9.1 Adoption Metrics
- **Active Users:** Number of users who log in weekly
- **Workspaces Created:** Total workspaces created per month
- **Tasks Created:** Total tasks created per month
- **Collaboration Rate:** Comments + mentions per task

### 9.2 Performance Metrics
- **Average Page Load Time:** < 2 seconds
- **API Response Time (p95):** < 500ms
- **Uptime:** > 99.5%
- **Failed Login Rate:** < 1%

### 9.3 Security Metrics
- **Password Compliance Rate:** % users with valid (non-expired) passwords
- **Account Lockout Events:** Number per month
- **Failed Login Attempts:** Number per month
- **Password Reset Requests:** Number per month

---

## 10. Acceptance Criteria

### 10.1 Feature Completeness
- ✅ All P1 (Critical) features implemented and tested
- ✅ All P2 (High) features implemented and tested
- ⚠️ P3 (Medium) features optional for MVP

### 10.2 Security Compliance
- ✅ Password requirements enforced (12+ chars, 90-day expiration)
- ✅ Account lockout working (5 attempts, 30-min lockout)
- ✅ Row-level security configured on all tables
- ✅ File upload restricted to authenticated users

### 10.3 Usability Testing
- ✅ All modals open/close properly
- ✅ Drag-and-drop works smoothly
- ✅ Forms validate correctly
- ✅ Error messages are clear and actionable
- ✅ Mobile responsive (at minimum, readable on mobile)

### 10.4 Performance Testing
- ✅ Page load < 2 seconds with typical data volume
- ✅ 50 concurrent users tested without performance degradation
- ✅ Database queries optimized (indexes in place)

### 10.5 Documentation
- ✅ Business Requirements Document
- ✅ Functional Requirements Document (this document)
- ✅ Database Schema Documentation
- ✅ Setup Instructions (SUPABASE_SETUP.md)
- ✅ Project Overview (Management Presentation)

---

## 11. Out of Scope (Future Enhancements)

The following features are **not** included in the current version but may be added in future releases:

### 11.1 Advanced Search & Filtering
- Full-text search across all tasks
- Advanced filter combinations
- Saved searches

### 11.2 Real-Time Collaboration
- Live cursor tracking
- Real-time comment updates
- Presence indicators (who's online)

### 11.3 Enhanced Security
- Two-factor authentication (2FA)
- IP-based blocking
- Session management dashboard

### 11.4 Reporting & Analytics
- Task completion reports
- Team productivity dashboard
- Time tracking

### 11.5 Integrations
- Slack notifications
- Email task creation
- Calendar sync
- Third-party app integrations

### 11.6 Advanced Comment Features
- Rich text formatting (bold, italic, lists)
- Code snippets with syntax highlighting
- GIF support
- Voice/video notes

### 11.7 Mobile Applications
- Native iOS app
- Native Android app

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **RLS** | Row-Level Security - PostgreSQL feature that filters queries based on user context |
| **Workspace** | Top-level organizational unit, analogous to a project or department |
| **Owner** | Workspace creator with full administrative privileges |
| **Editor** | Workspace member who can create and edit content |
| **Viewer** | Workspace member with read-only access |
| **Kanban** | Visual workflow management method using columns and cards |
| **Status Column** | Vertical column representing a task state (e.g., "In Progress") |
| **Subtask** | Checklist item within a task |
| **Thread** | Series of comments where replies are nested under parent comment |
| **@Mention** | Tagging a user in a comment using @username |
| **Reaction** | Emoji response to a comment (👍 ❤️ 😄 etc.) |
| **P1-P4** | Priority levels (P1=Highest, P4=Lowest) |
| **JWT** | JSON Web Token - Authentication token format |
| **Toast** | Temporary notification message that appears on screen |

---

## 13. Appendices

### Appendix A: Database Entity Relationship Diagram
See: `doc/db schema.sql` for complete schema

### Appendix B: User Flow Diagrams
See: `doc/Project Overview - Management Presentation.md`

### Appendix C: Security Implementation
See: `doc/password-security-implementation.md`

### Appendix D: Comments Enhancement
See: `doc/comments-enhancement-summary.md`

---

## 14. Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Product Owner** | ________________ | ________________ | ________ |
| **Technical Lead** | ________________ | ________________ | ________ |
| **Security Officer** | ________________ | ________________ | ________ |
| **Project Manager** | ________________ | ________________ | ________ |

---

**Document Status:** ✅ **FINALIZED - Ready for Production**

**Next Steps:**
1. Obtain stakeholder sign-off
2. Conduct User Acceptance Testing (UAT)
3. Prepare deployment plan
4. Schedule production release

---

*End of Functional Requirements Document*
