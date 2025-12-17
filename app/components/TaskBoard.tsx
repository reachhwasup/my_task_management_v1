"use client";

import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { CheckSquare, User, Calendar, Circle, Clock, CheckCircle, AlertCircle, Zap, Target, Flag, Plus, MoreVertical, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import RenameStatusModal from './RenameStatusModal';

// Updated Task Interface to include Subtasks
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  due_date: string;
  workspace_id: string;
  assignee_id?: string;
  assignee?: {
    username: string;
    firstname?: string;
    lastname?: string;
  };
  // We fetch a simplified list of subtasks to count them
  subtasks: { id: string; title: string; is_completed: boolean }[]; 
}

interface StatusColumn {
  id: string;
  label: string;
  color: string;
  headerColor: string;
  icon: React.ReactNode;
  is_system: boolean;
}

interface Props {
  tasks: Task[];
  workspaceId: string;
  onTasksChange: (updatedTasks: Task[]) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  onAddStatus: () => void;
  userPermission: string;
}

const ICON_MAP: { [key: string]: any } = {
  'circle': Circle,
  'clock': Clock,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'zap': Zap,
  'target': Target,
  'flag': Flag,
};

const getHeaderColor = (colorClass: string) => {
  const colorMap: { [key: string]: string } = {
    'bg-gray-50': 'bg-gray-200',
    'bg-blue-50': 'bg-blue-200',
    'bg-green-50': 'bg-green-200',
    'bg-yellow-50': 'bg-yellow-200',
    'bg-red-50': 'bg-red-200',
    'bg-purple-50': 'bg-purple-200',
    'bg-pink-50': 'bg-pink-200',
    'bg-indigo-50': 'bg-indigo-200',
  };
  return colorMap[colorClass] || 'bg-gray-200';
};

export default function TaskBoard({ tasks, workspaceId, onTasksChange, onTaskClick, onAddTask, onAddStatus, userPermission }: Props) {
  const [columns, setColumns] = useState<StatusColumn[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusToRename, setStatusToRename] = useState<{ id: string; label: string } | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStatuses();
  }, [workspaceId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadStatuses() {
    const { data } = await supabase
      .from('workspace_statuses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('position', { ascending: true });

    if (data) {
      const statusColumns = data.map((status: any) => {
        const IconComponent = ICON_MAP[status.icon_name] || Circle;
        return {
          id: status.status_key,
          label: status.status_label,
          color: status.color_class,
          headerColor: getHeaderColor(status.color_class),
          icon: <IconComponent size={16} className="text-gray-700" />,
          is_system: status.is_system
        };
      });
      setColumns(statusColumns);
    }
  }

  async function handleRenameStatus(statusId: string) {
    await loadStatuses();
    setStatusToRename(null);
    setOpenDropdown(null);
  }

  async function handleDeleteStatus(statusKey: string) {
    const tasksInColumn = tasks.filter(t => t.status === statusKey);
    if (tasksInColumn.length > 0) {
      alert(`Cannot delete this status. It contains ${tasksInColumn.length} task(s). Please move or delete the tasks first.`);
      return;
    }

    if (!confirm('Are you sure you want to delete this status column?')) {
      return;
    }

    const { error } = await supabase
      .from('workspace_statuses')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('status_key', statusKey);

    if (error) {
      alert('Error deleting status: ' + error.message);
    } else {
      await loadStatuses();
      setOpenDropdown(null);
    }
  }
  
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    // Prevent drag if user is viewer
    if (userPermission === 'viewer') return;

    const newStatus = destination.droppableId;
    
    // Optimistic UI Update
    const updatedTasks = tasks.map(t => 
      t.id === draggableId ? { ...t, status: newStatus } : t
    );
    onTasksChange(updatedTasks);

    // Database Update
    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', draggableId);
  };

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const toggleTaskExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  return (
    <>
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 pb-4 overflow-x-auto items-start">
        {columns.map((col) => (
          <Droppable key={col.id} droppableId={col.id}>
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-w-[280px] flex-1 rounded-xl p-4 flex flex-col ${col.color} border-2 border-transparent ${snapshot.isDraggingOver ? 'ring-2 ring-blue-400 border-blue-300 shadow-lg' : 'shadow-sm'} transition-all duration-200 min-h-[200px]`}
              >
                {/* Header */}
                <div className={`flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200 ${col.headerColor} -mx-4 px-4 -mt-4 pt-4 rounded-t-xl relative`}>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    {col.icon} {col.label}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white px-2.5 py-1 rounded-full text-gray-700 font-bold shadow-sm border border-gray-200">
                      {getTasksByStatus(col.id).length}
                    </span>
                    {userPermission !== 'viewer' && (
                      <div className="relative" ref={openDropdown === col.id ? dropdownRef : null}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === col.id ? null : col.id)}
                          className="p-1 hover:bg-white hover:bg-opacity-50 rounded transition"
                        >
                          <MoreVertical size={16} className="text-gray-600" />
                        </button>
                        
                        {openDropdown === col.id && (
                          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 z-50 min-w-[200px]">
                            <button
                              onClick={async () => {
                                const { data } = await supabase
                                  .from('workspace_statuses')
                                  .select('id, status_label')
                                  .eq('workspace_id', workspaceId)
                                  .eq('status_key', col.id)
                                  .single();
                                if (data) {
                                  setStatusToRename({ id: data.id, label: data.status_label });
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                            >
                              <Pencil size={14} />
                              Rename section
                            </button>
                            {!col.is_system && (
                              <button
                                onClick={() => handleDeleteStatus(col.id)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                              >
                                <Trash2 size={14} />
                                Delete section
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task List */}
                <div className="space-y-3 min-h-[50px]">
                  {getTasksByStatus(col.id).map((task, index) => {
                    // Calculate Progress Logic
                    const totalSub = task.subtasks?.length || 0;
                    const completedSub = task.subtasks?.filter(s => s.is_completed).length || 0;
                    
                    // Check if task is overdue
                    const isOverdue = task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();
                    
                    return (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onTaskClick(task)}
                            className={`bg-white p-4 rounded-xl shadow border-2 ${isOverdue ? 'border-red-400 bg-red-50' : 'border-gray-200'} hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer active:cursor-grabbing group ${snapshot.isDragging ? 'rotate-2 shadow-2xl ring-4 ring-blue-400 z-50 scale-105' : ''}`}
                            style={provided.draggableProps.style}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm ${
                                task.priority === 'P1' ? 'bg-red-500 text-white' :
                                task.priority === 'P2' ? 'bg-orange-500 text-white' :
                                'bg-gray-400 text-white'
                              }`}>
                                {task.priority}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] px-2 py-1 bg-red-600 text-white rounded-full font-bold animate-pulse shadow-sm">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            
                            <h4 className="text-sm font-bold text-gray-900 leading-snug mb-3 line-clamp-2">{task.title}</h4>
                            
                            {/* Assignee and Due Date */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {task.assignee && (
                                <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 font-medium">
                                  <User size={11} className="text-blue-600" />
                                  <span>{task.assignee.username.split('@')[0]}</span>
                                </div>
                              )}
                              {task.due_date && (
                                <div className="flex items-center gap-1.5 text-[11px] text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200 font-medium">
                                  <Calendar size={11} className="text-orange-600" />
                                  <span>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* FOOTER: Subtask Indicator */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <div className="text-[10px] text-gray-400 font-mono tracking-wider">
                                #{task.id.slice(0, 6).toUpperCase()}
                              </div>
                              
                              {/* Only show if there are subtasks */}
                              {totalSub > 0 && (
                                <button
                                  onClick={(e) => toggleTaskExpand(task.id, e)}
                                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-bold shadow-sm hover:scale-105 transition ${
                                    completedSub === totalSub ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {expandedTasks.has(task.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <CheckSquare size={12} />
                                  <span>{completedSub}/{totalSub}</span>
                                </button>
                              )}
                            </div>
                            
                            {/* Expanded Subtasks */}
                            {expandedTasks.has(task.id) && totalSub > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                                {task.subtasks.map((subtask) => (
                                  <div key={subtask.id} className="flex items-center gap-2 text-xs">
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                                      subtask.is_completed
                                        ? 'bg-green-500 border-green-500'
                                        : 'bg-white border-gray-300'
                                    }`}>
                                      {subtask.is_completed && (
                                        <CheckCircle size={10} className="text-white" strokeWidth={3} />
                                      )}
                                    </div>
                                    <span className={`${
                                      subtask.is_completed
                                        ? 'line-through text-gray-400'
                                        : 'text-gray-700'
                                    }`}>
                                      {subtask.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
                
                {/* Add Task Button */}
                {userPermission !== 'viewer' && (
                  <button
                    onClick={() => onAddTask(col.id)}
                    className="w-full mt-3 px-3 py-2 text-left text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition flex items-center gap-2 group"
                  >
                    <Plus size={16} className="text-gray-400 group-hover:text-gray-600" />
                    <span>Add task</span>
                  </button>
                )}
              </div>
            )}
          </Droppable>
        ))}
        
        {/* Add Status Button */}
        {userPermission !== 'viewer' && (
          <div className="min-w-[280px] w-[280px] flex-shrink-0">
            <button
              onClick={onAddStatus}
              className="w-full h-full min-h-[200px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-700 group"
            >
              <Plus size={32} className="text-gray-400 group-hover:text-gray-600" />
              <span className="font-semibold">Add Status</span>
            </button>
          </div>
        )}
      </div>
    </DragDropContext>
    
    {statusToRename && (
      <RenameStatusModal
        statusId={statusToRename.id}
        currentLabel={statusToRename.label}
        onClose={() => setStatusToRename(null)}
        onRenamed={() => handleRenameStatus(statusToRename.id)}
      />
    )}
    </>
  );
}