'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

export function FeedClassificationBar({ feedId, currentFilter }: { feedId: string; currentFilter?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<{ totalProcessed: number; politicalCount: number; nonPoliticalCount: number; failedCount: number } | null>(null);

  const handleClassify = async () => {
    setLoading(true);
    setMetrics(null);
    try {
      const res = await apiFetch<{ totalProcessed: number; politicalCount: number; nonPoliticalCount: number; failedCount: number }>(`/feeds/${feedId}/classify-political`, { method: 'POST' });
      setMetrics(res);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (val: string) => {
    router.push(`/feeds/${feedId}${val ? `?political=${val}` : ''}`);
  };

  return (
    <div className="flex flex-col gap-3 w-full mt-4 mb-2">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-50/50 p-3 rounded-md border border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-indigo-900">Filtro Ideológico:</span>
          <select 
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
            value={currentFilter || ''}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todos los artículos</option>
            <option value="true">Solo Políticos</option>
            <option value="false">Solo No Políticos</option>
          </select>
        </div>
        
        <div className="flex items-center gap-3">
          {metrics && (
             <span className="text-xs text-indigo-800 bg-white border border-indigo-200 px-2 py-1.5 rounded font-medium shadow-sm">
               Analizados: {metrics.totalProcessed} | Políticos: {metrics.politicalCount} | Fallos: {metrics.failedCount}
             </span>
          )}
          <button 
            onClick={handleClassify} 
            disabled={loading}
            className={`text-sm px-4 py-1.5 rounded shadow-sm font-medium transition-colors ${loading ? 'bg-indigo-300 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {loading ? 'Clasificando...' : 'Clasificar Artículos'}
          </button>
        </div>
      </div>
    </div>
  );
}
