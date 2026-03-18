'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface OutletOption {
  id: string;
  name: string;
}

interface OutletComparisonControlsProps {
  countryCode: string;
  outletOptions: OutletOption[];
  currentCompareA?: string;
  currentCompareB?: string;
  currentAvailabilityFilter?: string;
  currentStatusFilter?: string;
  currentIdeologyFilter?: string;
  currentSort?: string;
}

export function OutletComparisonControls({
  countryCode,
  outletOptions,
  currentCompareA,
  currentCompareB,
  currentAvailabilityFilter,
  currentStatusFilter,
  currentIdeologyFilter,
  currentSort,
}: OutletComparisonControlsProps) {
  const router = useRouter();

  const setComparison = (updates: { compareA?: string; compareB?: string }) => {
    const params = new URLSearchParams();

    const nextAvailability = currentAvailabilityFilter || '';
    const nextStatus = currentStatusFilter || '';
    const nextIdeology = currentIdeologyFilter || '';
    const nextSort = currentSort || 'name';
    const nextCompareA = updates.compareA !== undefined ? updates.compareA : (currentCompareA || '');
    const nextCompareB = updates.compareB !== undefined ? updates.compareB : (currentCompareB || '');

    if (nextAvailability) params.set('availability', nextAvailability);
    if (nextStatus) params.set('status', nextStatus);
    if (nextIdeology) params.set('ideology', nextIdeology);
    if (nextSort && nextSort !== 'name') params.set('sort', nextSort);
    if (nextCompareA) params.set('compareA', nextCompareA);
    if (nextCompareB) params.set('compareB', nextCompareB);

    const query = params.toString();
    router.push(`/countries/${countryCode}${query ? `?${query}` : ''}`);
  };

  const hasSelection = Boolean(currentCompareA || currentCompareB);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-indigo-100 bg-indigo-50/50 p-3">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-indigo-950">Comparar medios:</span>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
            value={currentCompareA || ''}
            onChange={(e) => setComparison({ compareA: e.target.value })}
          >
            <option value="">Selecciona el primer medio</option>
            {outletOptions.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
            value={currentCompareB || ''}
            onChange={(e) => setComparison({ compareB: e.target.value })}
          >
            <option value="">Selecciona el segundo medio</option>
            {outletOptions.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasSelection && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            onClick={() => setComparison({ compareA: '', compareB: '' })}
            className="text-gray-700 bg-white border border-gray-300 px-2 py-1.5 rounded font-medium shadow-sm hover:bg-gray-50"
          >
            Limpiar comparativa
          </button>
        </div>
      )}
    </div>
  );
}
