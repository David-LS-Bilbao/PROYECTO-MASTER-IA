'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface SyncResult {
  inserted: number;
  skipped: number;
  status: 'success' | 'failed';
  message?: string;
}

interface SyncButtonProps {
  feedId: string;
  onResult: (result: SyncResult | null) => void;
}

export function SyncButton({ feedId, onResult }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      onResult(null); // Resetea cualquier alerta anterior

      const data = await apiFetch<Record<string, unknown>>(`/feeds/${feedId}/sync`, {
        method: 'POST',
      });

      onResult({
        inserted: (data.inserted as number) || 0,
        skipped: (data.skipped as number) || 0,
        status: (data.status as 'success' | 'failed') || 'success',
      });
      
      // Forzar al Server Component superior a re-pedir datos (refrescar 'lastCheckedAt')
      router.refresh();

    } catch (err: unknown) {
      const error = err as Error;
      onResult({
        inserted: 0,
        skipped: 0,
        status: 'failed',
        message: error.message || 'Error de conexión al sincronizar.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`relative inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white transition-colors
        ${isSyncing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
      `}
    >
      {isSyncing ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Sincronizando...
        </>
      ) : (
        <>
          <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sincronizar
        </>
      )}
    </button>
  );
}
