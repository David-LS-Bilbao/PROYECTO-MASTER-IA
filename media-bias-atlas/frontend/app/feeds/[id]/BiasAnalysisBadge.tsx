import React from 'react';
import { ArticleBiasAnalysis, IdeologyLabel } from '@/types';
import { resolveBiasAnalysisStatus } from '@/lib/feedArticleFilters';

const ideologyLabels: Record<IdeologyLabel, string> = {
  LEFT: 'Izquierda',
  CENTER_LEFT: 'Centro-izquierda',
  CENTER: 'Centro',
  CENTER_RIGHT: 'Centro-derecha',
  RIGHT: 'Derecha',
  UNCLEAR: 'Incierto',
};

export function BiasAnalysisBadge({ analysis }: { analysis?: ArticleBiasAnalysis | null }) {
  const status = resolveBiasAnalysisStatus(analysis);

  if (status === 'FAILED') {
    return (
      <span
        className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-medium"
        title={analysis?.errorMessage || 'El análisis ideológico falló'}
      >
        Sesgo fallido
      </span>
    );
  }

  if (status !== 'COMPLETED') {
    return (
      <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
        Sesgo pendiente
      </span>
    );
  }

  const ideologyLabel = ideologyLabels[analysis?.ideologyLabel ?? 'UNCLEAR'];
  const confidenceText = analysis?.confidence !== null && analysis?.confidence !== undefined
    ? ` · ${Math.round(analysis.confidence * 100)}%`
    : '';

  return (
    <span className="text-xs bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded-full font-medium">
      {ideologyLabel}{confidenceText}
    </span>
  );
}
