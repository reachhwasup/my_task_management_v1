"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SpacePage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;

  useEffect(() => {
    async function fetchSpaceContext() {
      const { data: space } = await supabase
        .from('spaces')
        .select('id, workspace_id')
        .eq('id', spaceId)
        .single();

      if (space) {
        router.replace(`/?workspace=${space.workspace_id}&space=${spaceId}`);
      } else {
        router.replace('/');
      }
    }

    if (spaceId) {
      fetchSpaceContext();
    }
  }, [spaceId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
