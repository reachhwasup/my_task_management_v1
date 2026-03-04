"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  useEffect(() => {
    if (workspaceId) {
      router.replace(`/?workspace=${workspaceId}`);
    }
  }, [workspaceId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
