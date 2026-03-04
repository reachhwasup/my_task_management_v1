"use client";

import { useMemo } from 'react';
import {
    CheckCircle, Clock, AlertCircle, Calendar, TrendingUp,
    Flag, Users, BarChart3, Target, Zap
} from 'lucide-react';
import { getDueDateStatus } from '../utils/dueDateUtils';

interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
    description: string;
    due_date: string;
    workspace_id: string;
    created_at?: string;
    completed_at?: string;
    assignee_id?: string;
    assignee?: {
        username: string;
        firstname?: string;
        lastname?: string;
    };
    task_assignees?: Array<{
        profiles: {
            username: string;
            firstname?: string;
            lastname?: string;
        };
    }>;
    subtasks: { id: string; title: string; is_completed: boolean }[];
}

interface Member {
    id: string;
    username: string;
}

interface Props {
    tasks: Task[];
    members: Member[];
    workspaceId: string;
}

// ─── Donut Chart (pure SVG) ───
function DonutChart({ segments, size = 180, strokeWidth = 28 }: {
    segments: { value: number; color: string; label: string }[];
    size?: number;
    strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    if (total === 0) {
        return (
            <div className="flex items-center justify-center" style={{ width: size, height: size }}>
                <div className="text-gray-400 text-sm">No data</div>
            </div>
        );
    }

    let accumulatedOffset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {/* Background circle */}
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth}
            />
            {segments.filter(s => s.value > 0).map((segment, i) => {
                const segmentLength = (segment.value / total) * circumference;
                const offset = accumulatedOffset;
                accumulatedOffset += segmentLength;
                return (
                    <circle
                        key={i}
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                        style={{ animationDelay: `${i * 100}ms` }}
                    />
                );
            })}
            {/* Center text */}
            <text
                x={size / 2} y={size / 2}
                textAnchor="middle" dominantBaseline="central"
                className="fill-gray-800 font-bold transform rotate-90"
                style={{ fontSize: '28px', transformOrigin: 'center' }}
            >
                {total}
            </text>
        </svg>
    );
}

// ─── Bar (reusable) ───
function HorizontalBar({ value, max, color, label, count }: {
    value: number;
    max: number;
    color: string;
    label: string;
    count: number;
}) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="w-20 text-sm font-medium text-gray-700 text-right shrink-0">{label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative">
                <div
                    className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs font-bold text-gray-700">
                    {count}
                </span>
            </div>
        </div>
    );
}

export default function DashboardCharts({ tasks, members, workspaceId }: Props) {

    // ─── Calculate all analytics data ───
    const analytics = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Status counts
        const statusCounts = {
            completed: tasks.filter(t => t.status === 'completed').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            pending: tasks.filter(t => t.status === 'pending').length,
            not_started: tasks.filter(t => t.status === 'not_started').length,
        };

        // Priority counts
        const priorityCounts = {
            P1: tasks.filter(t => t.priority === 'P1').length,
            P2: tasks.filter(t => t.priority === 'P2').length,
            P3: tasks.filter(t => t.priority === 'P3').length,
            P4: tasks.filter(t => t.priority === 'P4').length,
        };

        // Overdue & due counts
        const overdue = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'overdue').length;
        const dueToday = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'due_today').length;
        const dueSoon = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'due_soon').length;

        // Completion rate
        const completionRate = tasks.length > 0
            ? Math.round((statusCounts.completed / tasks.length) * 100)
            : 0;

        // Assignee workload
        const assigneeMap = new Map<string, { total: number; completed: number; inProgress: number; username: string }>();
        tasks.forEach(task => {
            // Check task_assignees first, fall back to assignee_id
            const assignees: string[] = [];
            if (task.task_assignees && task.task_assignees.length > 0) {
                // For workload, we want user IDs — but we only have profiles
                // Use assignee_id as primary for counting
            }
            if (task.assignee_id) {
                assignees.push(task.assignee_id);
            }

            assignees.forEach(userId => {
                const member = members.find(m => m.id === userId);
                if (!member) return;

                const existing = assigneeMap.get(userId) || { total: 0, completed: 0, inProgress: 0, username: member.username };
                existing.total++;
                if (task.status === 'completed') existing.completed++;
                if (task.status === 'in_progress') existing.inProgress++;
                assigneeMap.set(userId, existing);
            });
        });

        // Unassigned count
        const unassigned = tasks.filter(t => !t.assignee_id).length;

        // Weekly completion trend (last 7 days)
        const weeklyTrend: { day: string; date: string; completed: number; created: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = d.toISOString().split('T')[0];

            // Count tasks that were completed on this day (using due_date as proxy if no completed_at)
            const completedOnDay = tasks.filter(t => {
                if (t.status !== 'completed') return false;
                // Use created_at as approximate completion tracking
                const taskDate = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
                return taskDate === dateStr;
            }).length;

            const createdOnDay = tasks.filter(t => {
                const taskDate = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
                return taskDate === dateStr;
            }).length;

            weeklyTrend.push({ day: dayStr, date: dateStr, completed: completedOnDay, created: createdOnDay });
        }

        const maxWeekly = Math.max(...weeklyTrend.map(d => Math.max(d.completed, d.created)), 1);

        return {
            total: tasks.length,
            statusCounts,
            priorityCounts,
            overdue,
            dueToday,
            dueSoon,
            completionRate,
            assigneeWorkload: Array.from(assigneeMap.values()).sort((a, b) => b.total - a.total),
            unassigned,
            weeklyTrend,
            maxWeekly,
        };
    }, [tasks, members]);

    const maxPriority = Math.max(
        analytics.priorityCounts.P1,
        analytics.priorityCounts.P2,
        analytics.priorityCounts.P3,
        analytics.priorityCounts.P4,
        1
    );

    const maxWorkload = Math.max(...analytics.assigneeWorkload.map(a => a.total), 1);

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-8">

            {/* ───────── Summary Cards ───────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">Total Tasks</span>
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Calendar className="text-blue-500" size={18} />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{analytics.total}</p>
                    <p className="text-xs text-gray-400 mt-1">{analytics.unassigned} unassigned</p>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">Completed</span>
                        <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                            <CheckCircle className="text-green-500" size={18} />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{analytics.statusCounts.completed}</p>
                    <p className="text-xs text-gray-400 mt-1">{analytics.completionRate}% completion rate</p>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">In Progress</span>
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Clock className="text-blue-500" size={18} />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{analytics.statusCounts.in_progress}</p>
                    <p className="text-xs text-gray-400 mt-1">{analytics.statusCounts.pending} pending</p>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">Overdue</span>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${analytics.overdue > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <AlertCircle className={analytics.overdue > 0 ? 'text-red-500' : 'text-gray-400'} size={18} />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold ${analytics.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {analytics.overdue}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {analytics.dueToday > 0 ? `${analytics.dueToday} due today` : 'All on track'}
                    </p>
                </div>
            </div>

            {/* ───────── Charts Row ───────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Status Distribution Donut */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                        <Target size={20} className="text-blue-500" />
                        Status Distribution
                    </h3>
                    <div className="flex items-center gap-8">
                        <DonutChart
                            segments={[
                                { value: analytics.statusCounts.completed, color: '#22c55e', label: 'Completed' },
                                { value: analytics.statusCounts.in_progress, color: '#3b82f6', label: 'In Progress' },
                                { value: analytics.statusCounts.pending, color: '#eab308', label: 'Pending' },
                                { value: analytics.statusCounts.not_started, color: '#d1d5db', label: 'Not Started' },
                            ]}
                        />
                        <div className="space-y-3 flex-1">
                            {[
                                { label: 'Completed', count: analytics.statusCounts.completed, color: 'bg-green-500', textColor: 'text-green-700' },
                                { label: 'In Progress', count: analytics.statusCounts.in_progress, color: 'bg-blue-500', textColor: 'text-blue-700' },
                                { label: 'Pending', count: analytics.statusCounts.pending, color: 'bg-yellow-400', textColor: 'text-yellow-700' },
                                { label: 'Not Started', count: analytics.statusCounts.not_started, color: 'bg-gray-300', textColor: 'text-gray-600' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                        <span className="text-sm text-gray-600">{item.label}</span>
                                    </div>
                                    <span className={`text-sm font-bold ${item.textColor}`}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Priority Breakdown */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                        <Flag size={20} className="text-orange-500" />
                        Priority Breakdown
                    </h3>
                    <div className="space-y-4">
                        <HorizontalBar value={analytics.priorityCounts.P1} max={maxPriority} color="bg-gradient-to-r from-red-400 to-red-500" label="🔴 Critical" count={analytics.priorityCounts.P1} />
                        <HorizontalBar value={analytics.priorityCounts.P2} max={maxPriority} color="bg-gradient-to-r from-orange-400 to-orange-500" label="🟠 High" count={analytics.priorityCounts.P2} />
                        <HorizontalBar value={analytics.priorityCounts.P3} max={maxPriority} color="bg-gradient-to-r from-blue-400 to-blue-500" label="🔵 Medium" count={analytics.priorityCounts.P3} />
                        <HorizontalBar value={analytics.priorityCounts.P4} max={maxPriority} color="bg-gradient-to-r from-gray-300 to-gray-400" label="⚪ Low" count={analytics.priorityCounts.P4} />
                    </div>

                    {/* Urgency summary */}
                    {(analytics.overdue > 0 || analytics.dueToday > 0 || analytics.dueSoon > 0) && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date Urgency</span>
                            <div className="flex gap-3 mt-2">
                                {analytics.overdue > 0 && (
                                    <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                        🔴 {analytics.overdue} overdue
                                    </span>
                                )}
                                {analytics.dueToday > 0 && (
                                    <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                                        🟠 {analytics.dueToday} today
                                    </span>
                                )}
                                {analytics.dueSoon > 0 && (
                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                        🟡 {analytics.dueSoon} soon
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ───────── Workload & Trend Row ───────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Assignee Workload */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                        <Users size={20} className="text-purple-500" />
                        Assignee Workload
                    </h3>
                    {analytics.assigneeWorkload.length > 0 ? (
                        <div className="space-y-3">
                            {analytics.assigneeWorkload.map((member, i) => (
                                <div key={i} className="group">
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                            {member.username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 truncate flex-1">
                                            {member.username.split('@')[0]}
                                        </span>
                                        <span className="text-xs font-bold text-gray-500">{member.total} tasks</span>
                                    </div>
                                    {/* Stacked bar */}
                                    <div className="ml-10 bg-gray-100 rounded-full h-5 overflow-hidden flex">
                                        {member.completed > 0 && (
                                            <div
                                                className="h-full bg-green-400 transition-all duration-700"
                                                style={{ width: `${(member.completed / maxWorkload) * 100}%` }}
                                                title={`Completed: ${member.completed}`}
                                            />
                                        )}
                                        {member.inProgress > 0 && (
                                            <div
                                                className="h-full bg-blue-400 transition-all duration-700"
                                                style={{ width: `${(member.inProgress / maxWorkload) * 100}%` }}
                                                title={`In Progress: ${member.inProgress}`}
                                            />
                                        )}
                                        {(member.total - member.completed - member.inProgress) > 0 && (
                                            <div
                                                className="h-full bg-gray-300 transition-all duration-700"
                                                style={{ width: `${((member.total - member.completed - member.inProgress) / maxWorkload) * 100}%` }}
                                                title={`Other: ${member.total - member.completed - member.inProgress}`}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* Legend */}
                            <div className="flex gap-4 mt-3 ml-10">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                    <span className="text-[11px] text-gray-500">Done</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                                    <span className="text-[11px] text-gray-500">In Progress</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                                    <span className="text-[11px] text-gray-500">Other</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Users size={32} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No assigned tasks yet</p>
                        </div>
                    )}
                </div>

                {/* Weekly Activity Trend */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-500" />
                        Weekly Activity
                    </h3>
                    <div className="flex items-end gap-2 h-44">
                        {analytics.weeklyTrend.map((day, i) => {
                            const isToday = i === analytics.weeklyTrend.length - 1;
                            const barHeight = analytics.maxWeekly > 0 ? (day.created / analytics.maxWeekly) * 100 : 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    {/* Count label */}
                                    <span className={`text-[10px] font-bold ${day.created > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                                        {day.created > 0 ? day.created : ''}
                                    </span>
                                    {/* Bar */}
                                    <div className="w-full flex-1 flex items-end">
                                        <div
                                            className={`w-full rounded-t-md transition-all duration-500 ${isToday
                                                    ? 'bg-gradient-to-t from-blue-500 to-blue-400'
                                                    : day.created > 0
                                                        ? 'bg-gradient-to-t from-blue-300 to-blue-200'
                                                        : 'bg-gray-100'
                                                }`}
                                            style={{ height: `${Math.max(barHeight, day.created > 0 ? 8 : 4)}%` }}
                                        />
                                    </div>
                                    {/* Day label */}
                                    <span className={`text-[11px] font-medium ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                                        {isToday ? 'Today' : day.day}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Summary */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                        <span className="text-xs text-gray-500">Tasks created this week</span>
                        <span className="text-xs font-bold text-gray-700">
                            {analytics.weeklyTrend.reduce((sum, d) => sum + d.created, 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* ───────── Completion Progress ───────── */}
            {analytics.total > 0 && (
                <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-blue-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Zap size={20} className="text-yellow-500" />
                            Overall Progress
                        </h3>
                        <span className="text-2xl font-bold text-blue-600">{analytics.completionRate}%</span>
                    </div>
                    <div className="w-full bg-white/60 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                            style={{ width: `${analytics.completionRate}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {analytics.statusCounts.completed} of {analytics.total} tasks completed
                        {analytics.statusCounts.in_progress > 0 && ` · ${analytics.statusCounts.in_progress} in progress`}
                    </p>
                </div>
            )}
        </div>
    );
}
