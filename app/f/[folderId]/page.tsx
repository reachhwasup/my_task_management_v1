"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as string;

  useEffect(() => {
    async function fetchFolderContext() {
      const { data: folder } = await supabase
        .from('folders')
        .select(`
          id,
          space_id,
          spaces!inner (
            id,
            workspace_id
          )
        `)
        .eq('id', folderId)
        .single();

      if (folder) {
        const space = folder.spaces as any;
        router.replace(`/?workspace=${space.workspace_id}&space=${space.id}&folder=${folderId}`);
      } else {
        router.replace('/');
      }
    }

    if (folderId) {
      fetchFolderContext();
    }
  }, [folderId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
