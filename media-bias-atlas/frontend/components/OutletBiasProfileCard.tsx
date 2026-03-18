import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { IdeologyLabel, OutletBiasProfile, OutletBiasStatus } from '@/types';

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

const ideologyOrder: IdeologyLabel[] = [
  'LEFT',
  'CENTER_LEFT',
  'CENTER',
  'CENTER_RIGHT',
  'RIGHT',
  'UNCLEAR',
];

interface OutletBiasProfileCardProps {
  profile: OutletBiasProfile | null;
  errorMessage?: string | null;
}

export function OutletBiasProfileCard({
  profile,
  errorMessage,
}: OutletBiasProfileCardProps) {
  if (errorMessage) {
    return (
      <Alert
        type="warning"
        title="Perfil ideológico no disponible"
        message={errorMessage}
      />
    );
  }

  if (!profile) {
    return null;
  }

  const dominantLabel = profile.dominantLabel
    ? ideologyLabels[profile.dominantLabel]
    : 'Sin dominancia clara';

  return (
    <section className="bg-white shadow-sm border border-gray-200 rounded-md p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Perfil ideológico del medio</h2>
        <p className="text-sm text-gray-500 mt-1">
          Basado solo en artículos políticos con análisis ideológico completado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Estado" value={statusLabels[profile.status]} />
        <SummaryMetric label="Etiqueta dominante" value={dominantLabel} />
        <SummaryMetric label="Artículos políticos" value={profile.totalPoliticalArticles} />
        <SummaryMetric label="Análisis completados" value={profile.totalCompletedAnalyses} />
      </div>

      {profile.status === 'INSUFFICIENT_DATA' ? (
        <Alert
          type="info"
          title="Todavía no hay suficiente muestra"
          message={`Se necesitan al menos ${profile.minimumSampleRequired} análisis completados para consolidar un perfil dominante fiable.`}
        />
      ) : null}

      {profile.status === 'ANALYZED' && profile.dominantLabel === null ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          El medio ya tiene muestra suficiente, pero la distribución actual no deja una dominancia ideológica clara.
        </p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {ideologyOrder.map((label) => (
          <div key={label} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-sm font-medium text-gray-800">{ideologyLabels[label]}</div>
            <div className="text-xs text-gray-500 mt-1">
              {profile.distribution[label]} artículos
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
