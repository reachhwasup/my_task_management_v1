"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ListPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.listId as string;

  useEffect(() => {
    async function fetchListContext() {
      const { data: list } = await supabase
        .from('lists')
        .select(`
          *,
          folders!inner (
            id,
            space_id,
            spaces!inner (
              id,
              workspace_id
            )
          )
        `)
        .eq('id', listId)
        .single();

      if (list) {
        const folder = list.folders as any;
        const space = folder.spaces;
        router.replace(`/?workspace=${space.workspace_id}&space=${space.id}&folder=${folder.id}&list=${listId}`);
      } else {
        router.replace('/');
      }
    }

    if (listId) {
      fetchListContext();
    }
  }, [listId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
