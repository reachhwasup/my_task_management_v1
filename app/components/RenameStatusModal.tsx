"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Circle, Clock, CheckCircle, AlertCircle, Zap, Target, Flag } from 'lucide-react';

interface Props {
  statusId?: string;
  workspaceId: string;
  statusKey: string;
  currentLabel: string;
  currentColor?: string;
  currentIcon?: string;
  isVirtual?: boolean;
  onClose: () => void;
  onRenamed: () => void;
}

const ICON_OPTIONS = [
  { name: 'circle', label: 'Circle', Icon: Circle },
  { name: 'clock', label: 'Clock', Icon: Clock },
  { name: 'check-circle', label: 'Check', Icon: CheckCircle },
  { name: 'alert-circle', label: 'Alert', Icon: AlertCircle },
  { name: 'zap', label: 'Lightning', Icon: Zap },
  { name: 'target', label: 'Target', Icon: Target },
  { name: 'flag', label: 'Flag', Icon: Flag },
];

const COLOR_OPTIONS = [
  { value: 'bg-gray-50', label: 'Gray', preview: 'bg-gray-200' },
  { value: 'bg-blue-50', label: 'Blue', preview: 'bg-blue-200' },
  { value: 'bg-green-50', label: 'Green', preview: 'bg-green-200' },
  { value: 'bg-yellow-50', label: 'Yellow', preview: 'bg-yellow-200' },
  { value: 'bg-red-50', label: 'Red', preview: 'bg-red-200' },
  { value: 'bg-purple-50', label: 'Purple', preview: 'bg-purple-200' },
  { value: 'bg-pink-50', label: 'Pink', preview: 'bg-pink-200' },
  { value: 'bg-indigo-50', label: 'Indigo', preview: 'bg-indigo-200' },
];

export default function RenameStatusModal({ statusId, workspaceId, statusKey, currentLabel, currentColor, currentIcon, isVirtual, onClose, onRenamed }: Props) {
  const [label, setLabel] = useState(currentLabel);
  const [colorClass, setColorClass] = useState(currentColor || 'bg-gray-50');
  const [iconName, setIconName] = useState(currentIcon || 'circle');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isVirtual) {
      // Get highest position
      const { data: statuses } = await supabase
        .from('workspace_statuses')
        .select('position')
        .eq('workspace_id', workspaceId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = statuses && statuses.length > 0 ? statuses[0].position + 1 : 1;

      // Insert instead of update
      const { error } = await supabase
        .from('workspace_statuses')
        .insert({
          workspace_id: workspaceId,
          status_key: statusKey,
          status_label: label,
          color_class: colorClass,
          icon_name: iconName,
          position: nextPosition,
          is_system: false
        });

      if (error) {
        alert(error.message);
      } else {
        onRenamed();
        onClose();
      }
    } else {
      // Update existing
      const { error } = await supabase
        .from('workspace_statuses')
        .update({
          status_label: label,
          color_class: colorClass,
          icon_name: iconName
        })
        .eq('id', statusId);

      if (error) {
        alert(error.message);
      } else {
        onRenamed();
        onClose();
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative shadow-2xl">

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">✏️ Customize Section</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Status Name</label>
            <input
              required
              autoFocus
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="e.g., Review, Testing, Blocked"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Icon</label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map(({ name, label: iconLabel, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIconName(name)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition ${iconName === name
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <Icon size={20} className={iconName === name ? "text-blue-600" : "text-gray-600"} />
                  <span className={`text-[9px] ${iconName === name ? "text-blue-700 font-bold" : "text-gray-600"}`}>{iconLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Color Label</label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map(({ value, label: colorLabel, preview }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColorClass(value)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition ${colorClass === value
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className={`w-8 h-8 rounded ${preview} border border-gray-300 shadow-sm`}></div>
                  <span className="text-[9px] font-medium text-gray-600 mt-1">{colorLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
