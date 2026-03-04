"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { BarChart3, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUserId(user.id);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <Sidebar workspaceId={workspaceId} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col overflow-auto">
        {/* Header */}
        <div className="bg-white border-b px-8 py-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 size={32} className="text-blue-600" />
            Dashboard & Analytics
          </h1>
          <p className="text-gray-600 mt-2">Track your tasks and team performance</p>
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-blue-600" size={24} />
                </div>
                <span className="text-2xl font-bold text-gray-900">0</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Completed Tasks</h3>
              <p className="text-xs text-green-600 mt-1">+0% from last week</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="text-yellow-600" size={24} />
                </div>
                <span className="text-2xl font-bold text-gray-900">0</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">In Progress</h3>
              <p className="text-xs text-gray-500 mt-1">Active tasks</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <span className="text-2xl font-bold text-gray-900">0</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Overdue</h3>
              <p className="text-xs text-red-600 mt-1">Needs attention</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-purple-600" size={24} />
                </div>
                <span className="text-2xl font-bold text-gray-900">0%</span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">Completion Rate</h3>
              <p className="text-xs text-gray-500 mt-1">This month</p>
            </div>
          </div>

          {/* Charts Placeholder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks by Status</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-400">
                  <BarChart3 size={48} className="mx-auto mb-2" />
                  <p>Chart coming soon</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Completion Trend</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-400">
                  <TrendingUp size={48} className="mx-auto mb-2" />
                  <p>Chart coming soon</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-400">
                  <BarChart3 size={48} className="mx-auto mb-2" />
                  <p>Chart coming soon</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center text-gray-400">
                  <BarChart3 size={48} className="mx-auto mb-2" />
                  <p>Chart coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
