Business Requirement Document (BRD)

Project: Internal Enterprise Task System

Version: 7.0 (Self-Service Model)
Date: December 11, 2025
Scope: Organization-wide (Multi-Department)

1. Executive Summary

Objective: Develop a secure, collaborative task management platform where teams can self-organize.
Core Philosophy: "Self-Service Collaboration." Any employee can spin up a workspace for a new project, become its admin, and invite colleagues without waiting for IT support.

2. Organization & Access Control

2.1. The "Two-Layer" Security Model

Layer 1: System Role (Global)

System Admin: Main IT Support. Maintains the server/database.

Standard User: Everyone else.

Layer 2: Workspace Permission (Contextual)

Owner (Workspace Admin): The person who created the workspace.

Capabilities: Invite/Remove members, Delete the workspace, Change workspace name.

Editor: Can create tasks, move cards, and comment.

Viewer: Read-only access.

2.2. Workspaces (Self-Service)

Creation: Any logged-in user can click "Create New Workspace."

Ownership: The system automatically assigns the Owner permission to the creator.

Types:

Personal: Private sandbox (created on signup).

Collaborative: Shared spaces created by users (e.g., "Holiday Party Planning", "Q4 Audit").

3. Functional Requirements

3.1. Invitation Logic

Who can invite? Only the Workspace Owner.

How? By entering an email address.

Role Assignment: The Owner selects whether the new member is an Editor or Viewer.

3.2. Task Lifecycle (Date-Driven)

Status: Not Started -> In Progress -> Pending -> Completed.

Automation:

Actual_Start_At stamped when moved to "In Progress".

Actual_Completed_At stamped when moved to "Completed".

3.3. Collaboration

Comments: Threaded.

Mentions: @Name.

Notifications: Alert for invites and mentions.

4. User Interface (UI) Requirements

4.1. Workspace Switcher

A sidebar menu listing:

"My Private Board"

"Shared with Me" (List of boards invited to)

"+ Create New Workspace" button.

4.2. The Kanban Board

4 Columns with Drag-and-Drop.

5. Security Policies

Data Isolation: A user cannot see a workspace unless they are the Owner or have been explicitly invited via workspace_members.