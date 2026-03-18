import React from 'react';
import { IdeologyLabel, OutletBiasSummary, OutletBiasStatus } from '@/types';

const ideologyLabels: Record<IdeologyLabel, string> = {
  LEFT: 'Izquierda',
  CENTER_LEFT: 'Centro-izquierda',
  CENTER: 'Centro',
  CENTER_RIGHT: 'Centro-derecha',
  RIGHT: 'Derecha',
  UNCLEAR: 'Incierto',
};

const statusLabels: Record<OutletBiasStatus, string> = {
  INSUFFICIENT_DATA: 'Muestra insuficiente',
  ANALYZED: 'Perfil disponible',
};

const statusStyles: Record<OutletBiasStatus, string> = {
  INSUFFICIENT_DATA: 'bg-amber-50 text-amber-800 border-amber-200',
  ANALYZED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

interface OutletBiasSummaryBlockProps {
  summary?: OutletBiasSummary | null;
}

export function OutletBiasSummaryBlock({ summary }: OutletBiasSummaryBlockProps) {
  if (!summary) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
        <p className="text-sm font-medium text-gray-700">Perfil ideológico no disponible</p>
        <p className="text-xs text-gray-500 mt-1">
          Todavía no se ha podido calcular un resumen reutilizable para este medio.
        </p>
      </div>
    );
  }

  const dominantLabel = summary.dominantLabel ? ideologyLabels[summary.dominantLabel] : null;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[summary.status]}`}>
          {statusLabels[summary.status]}
        </span>
        {dominantLabel ? (
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">
            {dominantLabel}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-gray-700">
        {summary.totalCompletedAnalyses} análisis completados
        <span className="text-gray-400"> · </span>
        {summary.totalPoliticalArticles} artículos políticos
      </p>

      {summary.status === 'ANALYZED' && !dominantLabel ? (
        <p className="text-xs text-gray-500">
          Hay muestra suficiente, pero sin una dominancia ideológica clara.
        </p>
      ) : null}

      {summary.status === 'INSUFFICIENT_DATA' ? (
        <p className="text-xs text-gray-500">
          Aún no hay base suficiente para consolidar una tendencia dominante.
        </p>
      ) : null}
    </div>
  );
}
