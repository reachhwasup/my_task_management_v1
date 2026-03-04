// Due Date Utility Functions
// Shared helpers for due date urgency across all components

export type DueDateStatus = 'overdue' | 'due_today' | 'due_soon' | 'normal' | null;

/**
 * Calculate the urgency status of a task's due date.
 * Returns null for completed/canceled tasks or tasks with no due date.
 */
export function getDueDateStatus(dueDate: string | null | undefined, taskStatus: string): DueDateStatus {
    if (!dueDate) return null;
    if (taskStatus === 'completed' || taskStatus === 'canceled') return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate + 'T00:00:00'); // Parse as local date
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due_today';
    if (diffDays <= 2) return 'due_soon';
    return 'normal';
}

/**
 * Get a human-readable label for the due date.
 */
export function getDueDateLabel(dueDate: string | null | undefined, taskStatus: string): string {
    if (!dueDate) return '';

    const status = getDueDateStatus(dueDate, taskStatus);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate + 'T00:00:00');
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    switch (status) {
        case 'overdue': {
            const overdueDays = Math.abs(diffDays);
            return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
        }
        case 'due_today':
            return 'Today';
        case 'due_soon':
            return diffDays === 1 ? 'Tomorrow' : `${diffDays} days left`;
        case 'normal':
            return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        default:
            return '';
    }
}

/**
 * Get Tailwind CSS classes for the due date badge.
 */
export function getDueDateBadgeStyles(status: DueDateStatus): {
    bg: string;
    text: string;
    border: string;
    icon: string;
} {
    switch (status) {
        case 'overdue':
            return {
                bg: 'bg-red-100',
                text: 'text-red-700',
                border: 'border-red-300',
                icon: 'text-red-600',
            };
        case 'due_today':
            return {
                bg: 'bg-orange-100',
                text: 'text-orange-700',
                border: 'border-orange-300',
                icon: 'text-orange-600',
            };
        case 'due_soon':
            return {
                bg: 'bg-amber-50',
                text: 'text-amber-700',
                border: 'border-amber-300',
                icon: 'text-amber-600',
            };
        case 'normal':
        default:
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-600',
                border: 'border-gray-200',
                icon: 'text-gray-500',
            };
    }
}

/**
 * Get card border style for the Kanban board.
 */
export function getCardBorderClass(status: DueDateStatus): string {
    switch (status) {
        case 'overdue':
            return 'border-red-400 bg-red-50/50';
        case 'due_today':
            return 'border-orange-400 bg-orange-50/30';
        case 'due_soon':
            return 'border-amber-300';
        default:
            return 'border-gray-200';
    }
}

/**
 * Get alert banner styles for the TaskDetailsModal.
 */
export function getDueDateAlertStyles(status: DueDateStatus): {
    bg: string;
    border: string;
    text: string;
    icon: string;
    emoji: string;
    label: string;
} | null {
    switch (status) {
        case 'overdue':
            return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-800',
                icon: 'text-red-500',
                emoji: '🔴',
                label: 'Overdue',
            };
        case 'due_today':
            return {
                bg: 'bg-orange-50',
                border: 'border-orange-200',
                text: 'text-orange-800',
                icon: 'text-orange-500',
                emoji: '🟠',
                label: 'Due Today',
            };
        case 'due_soon':
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-800',
                icon: 'text-amber-500',
                emoji: '🟡',
                label: 'Due Soon',
            };
        default:
            return null;
    }
}
