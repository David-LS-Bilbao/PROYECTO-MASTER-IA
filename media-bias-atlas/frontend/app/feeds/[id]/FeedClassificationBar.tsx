'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';

interface FeedClassificationBarProps {
  feedId: string;
  currentPoliticalFilter?: string;
  currentAnalysisFilter?: string;
  currentIdeologyFilter?: string;
}

interface ClassificationMetrics {
  totalProcessed: number;
  politicalCount: number;
  nonPoliticalCount: number;
  failedCount: number;
}

interface BiasMetrics {
  totalArticles: number;
  eligiblePolitical: number;
  skippedNonPolitical: number;
  alreadyCompleted: number;
  analyzedNow: number;
  failed: number;
}

export function FeedClassificationBar({
  feedId,
  currentPoliticalFilter,
  currentAnalysisFilter,
  currentIdeologyFilter,
}: FeedClassificationBarProps) {
  const router = useRouter();
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [classificationMetrics, setClassificationMetrics] = useState<ClassificationMetrics | null>(null);
  const [biasMetrics, setBiasMetrics] = useState<BiasMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClassify = async () => {
    setClassificationLoading(true);
    setClassificationMetrics(null);
    setErrorMessage(null);
    try {
      const res = await apiFetch<ClassificationMetrics>(`/feeds/${feedId}/classify-political`, { method: 'POST' });
      setClassificationMetrics(res);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo clasificar el feed.');
    } finally {
      setClassificationLoading(false);
    }
  };

  const handleAnalyzeBias = async () => {
    setAnalysisLoading(true);
    setBiasMetrics(null);
    setErrorMessage(null);
    try {
      const res = await apiFetch<BiasMetrics>(`/feeds/${feedId}/analyze-bias`, { method: 'POST' });
      setBiasMetrics(res);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo analizar el sesgo del feed.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const setFilters = (updates: { political?: string; analysis?: string; ideology?: string }) => {
    const params = new URLSearchParams();

    const nextPolitical = updates.political !== undefined ? updates.political : (currentPoliticalFilter || '');
    const nextAnalysis = updates.analysis !== undefined ? updates.analysis : (currentAnalysisFilter || '');
    const nextIdeology = updates.ideology !== undefined ? updates.ideology : (currentIdeologyFilter || '');

    if (nextPolitical) params.set('political', nextPolitical);
    if (nextAnalysis) params.set('analysis', nextAnalysis);
    if (nextIdeology) params.set('ideology', nextIdeology);

    const query = params.toString();
    router.push(`/feeds/${feedId}${query ? `?${query}` : ''}`);
  };

  return (
    <div className="flex flex-col gap-3 w-full mt-4 mb-2">
      {errorMessage && (
        <Alert type="error" message={errorMessage} />
      )}

      <div className="flex flex-col gap-4 bg-indigo-50/50 p-3 rounded-md border border-indigo-100">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-indigo-900">Filtros del feed:</span>
            <select
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
              value={currentPoliticalFilter || ''}
              onChange={(e) => setFilters({ political: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="true">Solo políticos</option>
              <option value="false">Solo no políticos</option>
            </select>

            <select
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
              value={currentAnalysisFilter || ''}
              onChange={(e) => setFilters({ analysis: e.target.value })}
            >
              <option value="">Todos los análisis</option>
              <option value="completed">Solo completados</option>
              <option value="failed">Solo fallidos</option>
              <option value="pending">Solo pendientes</option>
            </select>

            <select
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5"
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleClassify}
              disabled={classificationLoading || analysisLoading}
              className={`text-sm px-4 py-1.5 rounded shadow-sm font-medium transition-colors ${classificationLoading ? 'bg-indigo-300 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {classificationLoading ? 'Clasificando...' : 'Clasificar artículos'}
            </button>

            <button
              onClick={handleAnalyzeBias}
              disabled={analysisLoading || classificationLoading}
              className={`text-sm px-4 py-1.5 rounded shadow-sm font-medium transition-colors ${analysisLoading ? 'bg-sky-300 cursor-not-allowed text-white' : 'bg-sky-600 hover:bg-sky-700 text-white'}`}
            >
              {analysisLoading ? 'Analizando sesgo...' : 'Analizar sesgo'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {classificationMetrics && (
            <span className="text-indigo-800 bg-white border border-indigo-200 px-2 py-1.5 rounded font-medium shadow-sm">
              Clasificación: {classificationMetrics.totalProcessed} procesados · {classificationMetrics.politicalCount} políticos · {classificationMetrics.failedCount} fallidos
            </span>
          )}
          {biasMetrics && (
            <span className="text-sky-800 bg-white border border-sky-200 px-2 py-1.5 rounded font-medium shadow-sm">
              Sesgo: {biasMetrics.eligiblePolitical} políticos elegibles · {biasMetrics.analyzedNow} nuevos · {biasMetrics.alreadyCompleted} ya completados · {biasMetrics.failed} fallidos
            </span>
          )}
          {(currentPoliticalFilter || currentAnalysisFilter || currentIdeologyFilter) && (
            <button
              onClick={() => setFilters({ political: '', analysis: '', ideology: '' })}
              className="text-gray-700 bg-white border border-gray-300 px-2 py-1.5 rounded font-medium shadow-sm hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
