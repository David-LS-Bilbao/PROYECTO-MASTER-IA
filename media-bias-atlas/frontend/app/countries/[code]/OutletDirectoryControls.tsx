'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface OutletDirectoryControlsProps {
  countryCode: string;
  currentAvailabilityFilter?: string;
  currentStatusFilter?: string;
  currentIdeologyFilter?: string;
  currentSort?: string;
  currentCompareA?: string;
  currentCompareB?: string;
  totalOutlets: number;
  visibleOutlets: number;
}

export function OutletDirectoryControls({
  countryCode,
  currentAvailabilityFilter,
  currentStatusFilter,
  currentIdeologyFilter,
  currentSort,
  currentCompareA,
  currentCompareB,
  totalOutlets,
  visibleOutlets,
}: OutletDirectoryControlsProps) {
  const router = useRouter();

  const setFilters = (updates: {
    availability?: string;
    status?: string;
    ideology?: string;
    sort?: string;
  }) => {
    const params = new URLSearchParams();

    const nextAvailability = updates.availability !== undefined ? updates.availability : (currentAvailabilityFilter || '');
    const nextStatus = updates.status !== undefined ? updates.status : (currentStatusFilter || '');
    const nextIdeology = updates.ideology !== undefined ? updates.ideology : (currentIdeologyFilter || '');
    const nextSort = updates.sort !== undefined ? updates.sort : (currentSort || 'name');
    const nextCompareA = currentCompareA || '';
    const nextCompareB = currentCompareB || '';

    if (nextAvailability) params.set('availability', nextAvailability);
    if (nextStatus) params.set('status', nextStatus);
    if (nextIdeology) params.set('ideology', nextIdeology);
    if (nextSort && nextSort !== 'name') params.set('sort', nextSort);
    if (nextCompareA) params.set('compareA', nextCompareA);
    if (nextCompareB) params.set('compareB', nextCompareB);

    const query = params.toString();
    router.push(`/countries/${countryCode}${query ? `?${query}` : ''}`);
  };

  const hasActiveFilters = Boolean(
    currentAvailabilityFilter
    || currentStatusFilter
    || currentIdeologyFilter
    || (currentSort && currentSort !== 'name')
  );

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-900">Explorar medios:</span>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 py-1.5"
            value={currentAvailabilityFilter || ''}
            onChange={(e) => setFilters({ availability: e.target.value })}
          >
            <option value="">Toda la disponibilidad</option>
            <option value="available">Con perfil disponible</option>
            <option value="limited">Sin perfil suficiente</option>
          </select>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 py-1.5"
            value={currentStatusFilter || ''}
            onChange={(e) => setFilters({ status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="ANALYZED">Perfil disponible</option>
            <option value="INSUFFICIENT_DATA">Muestra insuficiente</option>
            <option value="NO_SUMMARY">Sin resumen</option>
          </select>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 py-1.5"
            value={currentIdeologyFilter || ''}
            onChange={(e) => setFilters({ ideology: e.target.value })}
          >
            <option value="">Todas las etiquetas</option>
            <option value="LEFT">Izquierda</option>
            <option value="CENTER_LEFT">Centro-izquierda</option>
            <option value="CENTER">Centro</option>
            <option value="CENTER_RIGHT">Centro-derecha</option>
            <option value="RIGHT">Derecha</option>
            <option value="UNCLEAR">Incierto</option>
          </select>

          <select
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 py-1.5"
            value={currentSort || 'name'}
            onChange={(e) => setFilters({ sort: e.target.value })}
          >
            <option value="name">Ordenar por nombre</option>
            <option value="completed-analyses">Más análisis completados</option>
            <option value="profile-first">Perfil disponible primero</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="bg-white border border-slate-200 px-2 py-1.5 rounded font-medium text-slate-700 shadow-sm">
          Mostrando {visibleOutlets} de {totalOutlets} medios
        </span>

        {hasActiveFilters && (
          <button
            onClick={() => setFilters({ availability: '', status: '', ideology: '', sort: 'name' })}
            className="text-gray-700 bg-white border border-gray-300 px-2 py-1.5 rounded font-medium shadow-sm hover:bg-gray-50"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
