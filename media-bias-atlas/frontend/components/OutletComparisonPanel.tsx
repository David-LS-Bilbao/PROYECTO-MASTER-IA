import React from 'react';
import { Outlet, OutletBiasProfile } from '@/types';
import { OutletBiasProfileCard } from '@/components/OutletBiasProfileCard';
import { getWebsiteDisplayLabel } from '@/lib/urlDisplay';

interface OutletComparisonPanelProps {
  outlet: Outlet;
  profile: OutletBiasProfile | null;
  errorMessage?: string | null;
}

export function OutletComparisonPanel({
  outlet,
  profile,
  errorMessage,
}: OutletComparisonPanelProps) {
  const websiteHostname = getWebsiteDisplayLabel(outlet.websiteUrl);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500">Medio comparado</p>
        <h3 className="text-lg font-semibold text-gray-900 mt-1">{outlet.name}</h3>
        {websiteHostname ? (
          <p className="text-sm text-gray-500 mt-1">{websiteHostname}</p>
        ) : null}
      </div>

      <OutletBiasProfileCard profile={profile} errorMessage={errorMessage} />
    </div>
  );
}
