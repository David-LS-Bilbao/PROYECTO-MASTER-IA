import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { FeedBiasSummary, IdeologyLabel } from '@/types';

const ideologyLabels: Record<IdeologyLabel, string> = {
  LEFT: 'Izquierda',
  CENTER_LEFT: 'Centro-izquierda',
  CENTER: 'Centro',
  CENTER_RIGHT: 'Centro-derecha',
  RIGHT: 'Derecha',
  UNCLEAR: 'Incierto',
};

const ideologyOrder: IdeologyLabel[] = [
  'LEFT',
  'CENTER_LEFT',
  'CENTER',
  'CENTER_RIGHT',
  'RIGHT',
  'UNCLEAR',
];

interface FeedBiasSummaryCardProps {
  summary: FeedBiasSummary | null;
  errorMessage?: string | null;
}

export function FeedBiasSummaryCard({ summary, errorMessage }: FeedBiasSummaryCardProps) {
  if (errorMessage) {
    return (
      <Alert
        type="warning"
        title="Resumen ideológico no disponible"
        message={errorMessage}
      />
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <section className="bg-white shadow-sm border border-gray-200 rounded-md p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Resumen ideológico del feed</h2>
        <p className="text-sm text-gray-500 mt-1">
          Solo incluye artículos marcados como políticos y usa análisis completados para la distribución ideológica.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Políticos" value={summary.totalPoliticalArticles} />
        <SummaryMetric label="Analizados" value={summary.analyzedArticles} />
        <SummaryMetric label="Pendientes" value={summary.pendingAnalysis} />
        <SummaryMetric label="Fallidos" value={summary.failedAnalysis} />
      </div>

      {summary.totalPoliticalArticles === 0 ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Este feed todavía no tiene artículos clasificados como políticos.
        </p>
      ) : summary.analyzedArticles === 0 ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Aún no hay análisis ideológicos completados para este feed.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ideologyOrder.map((label) => (
            <div key={label} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-sm font-medium text-gray-800">{ideologyLabels[label]}</div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.ideologyCounts[label].count} artículos · {summary.ideologyCounts[label].percentage}%
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
