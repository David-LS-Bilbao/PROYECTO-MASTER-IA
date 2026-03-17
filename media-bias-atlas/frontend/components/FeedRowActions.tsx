'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SyncButton } from './SyncButton';
import { Alert } from './ui/Alert';

interface FeedRowActionsProps {
  feedId: string;
}

export function FeedRowActions({ feedId }: FeedRowActionsProps) {
  const [syncResult, setSyncResult] = useState<{
    inserted: number;
    skipped: number;
    status: 'success' | 'failed';
    message?: string;
  } | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 shrink-0">
        <SyncButton feedId={feedId} onResult={setSyncResult} />
        
        <Link 
          href={`/feeds/${feedId}`}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
        >
          Ver Artículos &rarr;
        </Link>
      </div>
      
      {syncResult && (
        <div className="text-right w-full sm:w-64 max-w-sm mt-1">
          {syncResult.status === 'failed' ? (
             <Alert type="error" message={syncResult.message || 'Falló la sincronización'} />
          ) : (
            <Alert 
              type={syncResult.inserted === 0 ? 'info' : 'success'} 
              title={syncResult.inserted === 0 ? "Sin Novedades" : "Notas Guardadas"}
              message={`Nuevas: ${syncResult.inserted} | Omitidas: ${syncResult.skipped}`} 
            />
          )}
        </div>
      )}
    </div>
  );
}
