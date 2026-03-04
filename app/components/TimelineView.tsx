"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, User, GripVertical, AlertTriangle } from 'lucide-react';
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
  actual_start_at?: string;
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

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; barColor: string; barBorder: string }> = {
  not_started: { label: 'To Do', color: 'text-gray-600', barColor: 'bg-gray-300', barBorder: 'border-gray-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', barColor: 'bg-blue-400', barBorder: 'border-blue-500' },
  pending: { label: 'Pending', color: 'text-yellow-600', barColor: 'bg-yellow-400', barBorder: 'border-yellow-500' },
  completed: { label: 'Done', color: 'text-green-600', barColor: 'bg-green-400', barBorder: 'border-green-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: 'bg-red-400',
  P2: 'bg-orange-400',
  P3: 'bg-blue-400',
  P4: 'bg-gray-300',
};

const DAY_WIDTH = 44; // px per day column
const SIDEBAR_WIDTH = 280;
const ROW_HEIGHT = 42;
const HEADER_HEIGHT = 64;

export default function TimelineView({ tasks, onTaskClick }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const todayRef = useRef<HTMLDivElement>(null);

  // Compute date range: from earliest task start to latest due date, or default to ±30 days from today
  const { startDate, endDate, totalDays, dayColumns } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 14);
    let maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 45);

    tasks.forEach(t => {
      const start = getTaskStartDate(t);
      const end = t.due_date ? new Date(t.due_date) : null;
      if (start && start < minDate) {
        minDate = new Date(start);
        minDate.setDate(minDate.getDate() - 3);
      }
      if (end && end > maxDate) {
        maxDate = new Date(end);
        maxDate.setDate(maxDate.getDate() + 7);
      }
    });

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const dayColumns: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + i);
      dayColumns.push(d);
    }

    return { startDate: minDate, endDate: maxDate, totalDays, dayColumns };
  }, [tasks]);

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    const statusOrder = ['not_started', 'in_progress', 'pending', 'completed'];

    // Init all groups
    statusOrder.forEach(s => { groups[s] = []; });

    tasks.forEach(t => {
      const status = statusOrder.includes(t.status) ? t.status : 'not_started';
      if (!groups[status]) groups[status] = [];
      groups[status].push(t);
    });

    // Sort tasks within each group by due_date
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    }

    return statusOrder
      .filter(s => groups[s] && groups[s].length > 0)
      .map(s => ({ status: s, tasks: groups[s] }));
  }, [tasks]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const scrollX = Math.max(0, (daysSinceStart * DAY_WIDTH) - 200);
      scrollContainerRef.current.scrollLeft = scrollX;
    }
  }, [startDate]);

  // Sync sidebar + header scroll with the main grid
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop = scrollContainerRef.current.scrollTop;
      }
      if (headerRef.current) {
        headerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      }
    }
  };

  function toggleSection(status: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function getTaskStartDate(task: Task): Date | null {
    if (task.actual_start_at) return new Date(task.actual_start_at);
    if (task.created_at) return new Date(task.created_at);
    return null;
  }

  function getBarStyle(task: Task): { left: number; width: number } | null {
    const taskStart = getTaskStartDate(task);
    const taskEnd = task.due_date ? new Date(task.due_date) : null;

    if (!taskStart && !taskEnd) return null;

    const effectiveStart = taskStart || taskEnd!;
    const effectiveEnd = taskEnd || new Date(effectiveStart.getTime() + 3 * 24 * 60 * 60 * 1000); // default 3 day span

    const startOffset = Math.floor((effectiveStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const endOffset = Math.floor((effectiveEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const barDays = Math.max(1, endOffset - startOffset + 1);

    return {
      left: startOffset * DAY_WIDTH,
      width: barDays * DAY_WIDTH - 4
    };
  }

  function getBarColor(task: Task): string {
    const dueDateStatus = getDueDateStatus(task.due_date, task.status);
    // Overdue tasks get red bars
    if (dueDateStatus === 'overdue') return 'bg-gradient-to-r from-red-400 to-red-500';
    // Due today tasks get orange bars
    if (dueDateStatus === 'due_today') return 'bg-gradient-to-r from-orange-300 to-orange-400';

    const statusConf = STATUS_CONFIG[task.status];
    if (!statusConf) return 'bg-gray-300';
    // Use priority-tinted colors for more visual info
    if (task.priority === 'P1') return 'bg-gradient-to-r from-red-300 to-red-400';
    if (task.priority === 'P2') return 'bg-gradient-to-r from-orange-300 to-orange-400';
    if (task.status === 'completed') return 'bg-gradient-to-r from-green-300 to-green-400';
    if (task.status === 'in_progress') return 'bg-gradient-to-r from-blue-300 to-blue-400';
    if (task.status === 'pending') return 'bg-gradient-to-r from-yellow-300 to-yellow-400';
    return 'bg-gradient-to-r from-gray-200 to-gray-300';
  }

  function getAssigneeInitial(task: Task): string | null {
    if (task.task_assignees && task.task_assignees.length > 0) {
      return task.task_assignees[0].profiles.username.charAt(0).toUpperCase();
    }
    if (task.assignee) {
      return task.assignee.username.charAt(0).toUpperCase();
    }
    return null;
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  }

  function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  // Build flat list of visible rows
  const visibleRows: Array<{ type: 'section'; status: string; count: number } | { type: 'task'; task: Task }> = [];
  groupedTasks.forEach(group => {
    visibleRows.push({ type: 'section', status: group.status, count: group.tasks.length });
    if (!collapsedSections.has(group.status)) {
      group.tasks.forEach(t => visibleRows.push({ type: 'task', task: t }));
    }
  });

  // Get today's offset for the marker
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayOffset = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Month headers
  const monthHeaders = useMemo(() => {
    const months: Array<{ label: string; startIdx: number; span: number }> = [];
    let currentMonth = -1;
    let currentStartIdx = 0;

    dayColumns.forEach((d, i) => {
      const month = d.getMonth();
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          months.push({
            label: dayColumns[currentStartIdx].toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            startIdx: currentStartIdx,
            span: i - currentStartIdx
          });
        }
        currentMonth = month;
        currentStartIdx = i;
      }
    });
    // Push last month
    months.push({
      label: dayColumns[currentStartIdx].toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      startIdx: currentStartIdx,
      span: dayColumns.length - currentStartIdx
    });

    return months;
  }, [dayColumns]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* === TOP ROW: Fixed Header === */}
      <div className="flex flex-shrink-0" style={{ height: HEADER_HEIGHT }}>
        {/* Top-left corner (fixed) */}
        <div className="flex-shrink-0 border-r border-b border-gray-200 bg-gray-50 px-4 flex items-center" style={{ width: SIDEBAR_WIDTH }}>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</span>
        </div>

        {/* Calendar header (scrolls horizontally, synced) */}
        <div className="flex-1 overflow-hidden border-b border-gray-200">
          <div ref={headerRef} className="overflow-hidden h-full" style={{ scrollbarWidth: 'none' }}>
            <div style={{ width: totalDays * DAY_WIDTH }}>
              {/* Month Row */}
              <div className="flex h-7 border-b border-gray-100">
                {monthHeaders.map((mh, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-semibold text-gray-500 px-3 flex items-center border-r border-gray-100"
                    style={{ width: mh.span * DAY_WIDTH }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
              {/* Day Row */}
              <div className="flex" style={{ height: HEADER_HEIGHT - 28 }}>
                {dayColumns.map((d, i) => {
                  const dayIsToday = isToday(d);
                  const weekend = isWeekend(d);
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center text-[11px] border-r border-gray-100 flex-shrink-0 ${dayIsToday
                          ? 'bg-blue-600 text-white font-bold rounded-b-md'
                          : weekend
                            ? 'text-gray-400 bg-gray-50/50'
                            : 'text-gray-500'
                        }`}
                      style={{ width: DAY_WIDTH }}
                    >
                      <span className="leading-none">{d.getDate()}</span>
                      <span className="text-[9px] leading-none mt-0.5">
                        {d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === BOTTOM ROW: Sidebar + Scrollable Grid === */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar (fixed, syncs vertical scroll) */}
        <div className="flex-shrink-0 border-r border-gray-200 bg-white" style={{ width: SIDEBAR_WIDTH }}>
          <div ref={sidebarRef} className="overflow-hidden h-full" style={{ scrollbarWidth: 'none' }}>
            {visibleRows.map((row, i) => {
              if (row.type === 'section') {
                const conf = STATUS_CONFIG[row.status] || STATUS_CONFIG.not_started;
                return (
                  <div
                    key={`section-${row.status}`}
                    className="flex items-center gap-2 px-4 border-b border-gray-100 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition select-none"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleSection(row.status)}
                  >
                    {collapsedSections.has(row.status) ? (
                      <ChevronRight size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                    <span className={`text-sm font-semibold ${conf.color}`}>{conf.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{row.count}</span>
                  </div>
                );
              }

              const task = row.task;
              const assigneeInitial = getAssigneeInitial(task);
              return (
                <div
                  key={`task-${task.id}`}
                  className="flex items-center gap-2 px-4 border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition group"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskClick(task)}
                >
                  {assigneeInitial ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {assigneeInitial}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0">
                      <User size={12} />
                    </div>
                  )}
                  {(() => {
                    const taskDueDateStatus = getDueDateStatus(task.due_date, task.status);
                    const isOverdue = taskDueDateStatus === 'overdue';
                    const isDueToday = taskDueDateStatus === 'due_today';
                    return (
                      <span className={`text-sm truncate flex-1 flex items-center gap-1 ${task.status === 'completed' ? 'line-through text-gray-400' :
                          isOverdue ? 'text-red-600 font-medium' :
                            isDueToday ? 'text-orange-600' : 'text-gray-800'
                        }`}>
                        {isOverdue && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                        {task.title}
                      </span>
                    );
                  })()}
                </div>
              );
            })}

            {tasks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                No tasks yet
              </div>
            )}
          </div>
        </div>

        {/* Calendar grid (the ONLY scrollable area — both directions) */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="overflow-auto h-full"
            onScroll={handleScroll}
          >
            <div className="relative" style={{ width: totalDays * DAY_WIDTH }}>
              {/* Background Grid Lines (vertical) */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                {dayColumns.map((d, i) => {
                  const weekend = isWeekend(d);
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 border-r ${weekend ? 'bg-gray-50/60 border-gray-100' : 'border-gray-50'}`}
                      style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  );
                })}
              </div>

              {/* Today Marker */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  ref={todayRef}
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 - 1, width: 2 }}
                >
                  <div className="w-full h-full bg-blue-500 opacity-60"></div>
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white shadow"></div>
                </div>
              )}

              {/* Task Rows */}
              {visibleRows.map((row, rowIdx) => {
                if (row.type === 'section') {
                  return (
                    <div
                      key={`grid-section-${row.status}`}
                      className="border-b border-gray-100 bg-gray-50/40"
                      style={{ height: ROW_HEIGHT }}
                    />
                  );
                }

                const task = row.task;
                const barStyle = getBarStyle(task);
                const assigneeInitial = getAssigneeInitial(task);

                return (
                  <div
                    key={`grid-task-${task.id}`}
                    className="relative border-b border-gray-50 hover:bg-blue-50/20 transition"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {barStyle && (
                      <div
                        className={`absolute top-[8px] rounded-md cursor-pointer transition-all hover:brightness-95 hover:shadow-md group/bar border ${getBarColor(task)} ${task.status === 'completed' ? 'opacity-60 border-green-400' :
                            getDueDateStatus(task.due_date, task.status) === 'overdue' ? 'border-red-500 shadow-sm shadow-red-200' :
                              getDueDateStatus(task.due_date, task.status) === 'due_today' ? 'border-orange-400 shadow-sm shadow-orange-200' :
                                task.priority === 'P1' ? 'border-red-400' :
                                  task.priority === 'P2' ? 'border-orange-400' :
                                    task.status === 'in_progress' ? 'border-blue-400' :
                                      task.status === 'pending' ? 'border-yellow-400' : 'border-gray-300'
                          }`}
                        style={{
                          left: barStyle.left,
                          width: Math.max(barStyle.width, 28),
                          height: ROW_HEIGHT - 16,
                          zIndex: 5,
                        }}
                        onClick={() => onTaskClick(task)}
                        title={`${task.title}${task.due_date ? '\nDue: ' + new Date(task.due_date).toLocaleDateString() : ''}`}
                      >
                        <div className="flex items-center h-full px-2 gap-1.5 overflow-hidden">
                          {assigneeInitial && (
                            <div className="w-5 h-5 rounded-full bg-white/60 text-gray-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0 border border-white/80">
                              {assigneeInitial}
                            </div>
                          )}
                          <span className="text-[11px] font-medium text-gray-800 truncate leading-none">
                            {task.title}
                          </span>
                        </div>

                        {/* Due date milestone marker */}
                        {task.due_date && (
                          <div
                            className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition ${getDueDateStatus(task.due_date, task.status) === 'overdue'
                                ? 'bg-red-500 border-red-300 opacity-100 animate-pulse'
                                : getDueDateStatus(task.due_date, task.status) === 'due_today'
                                  ? 'bg-orange-500 border-orange-300 opacity-100 animate-pulse'
                                  : 'bg-white border-current opacity-0 group-hover/bar:opacity-100'
                              }`}
                            style={{ color: task.priority === 'P1' ? '#ef4444' : task.status === 'completed' ? '#22c55e' : '#3b82f6' }}
                          />
                        )}
                      </div>
                    )}

                    {/* No dates indicator */}
                    {!barStyle && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 italic">No dates set</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
