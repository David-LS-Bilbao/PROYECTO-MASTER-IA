'use client';

import React, { useState } from 'react';
import { SyncButton } from '@/components/SyncButton';
import { Alert } from '@/components/ui/Alert';

export function SyncReloader({ feedId }: { feedId: string }) {
  const [syncResult, setSyncResult] = useState<{
    inserted: number;
    skipped: number;
    status: 'success' | 'failed';
    message?: string;
  } | null>(null);

  return (
    <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full justify-end">
      {syncResult && (
        <div className="text-right text-xs shrink-0 max-w-[200px]">
          {syncResult.status === 'failed' ? (
             <Alert type="error" message={syncResult.message || 'Error'} />
          ) : (
             <span className={`px-2 py-1 rounded inline-block border ${syncResult.inserted === 0 ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
               {syncResult.inserted === 0 ? 'Sin noticias nuevas' : `+${syncResult.inserted} Guardadas`}
             </span>
          )}
        </div>
      )}
      
      <SyncButton feedId={feedId} onResult={setSyncResult} />
    </div>
  );
}
