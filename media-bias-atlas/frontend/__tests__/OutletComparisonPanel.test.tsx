import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OutletComparisonPanel } from '@/components/OutletComparisonPanel';
import { Outlet, OutletBiasProfile } from '@/types';

const outlet: Outlet = {
  id: 'outlet-1',
  name: 'Alpha Diario',
  websiteUrl: 'https://www.alpha.example.com',
  countryId: 'ES',
  biasSummary: null,
};

const profile: OutletBiasProfile = {
  outletId: 'outlet-1',
  status: 'ANALYZED',
  totalPoliticalArticles: 18,
  totalCompletedAnalyses: 9,
  minimumSampleRequired: 5,
  dominantLabel: 'CENTER',
  distribution: {
    LEFT: 1,
    CENTER_LEFT: 2,
    CENTER: 4,
    CENTER_RIGHT: 1,
    RIGHT: 1,
    UNCLEAR: 0,
  },
};

describe('OutletComparisonPanel', () => {
  it('muestra el encabezado del medio y su perfil ideológico', () => {
    render(<OutletComparisonPanel outlet={outlet} profile={profile} />);

    expect(screen.getByText('Alpha Diario')).toBeInTheDocument();
    expect(screen.getByText('alpha.example.com')).toBeInTheDocument();
    expect(screen.getByText('Perfil ideológico del medio')).toBeInTheDocument();
    expect(screen.getAllByText('Centro')).toHaveLength(2);
  });

  it('muestra error controlado cuando el perfil no se puede cargar', () => {
    render(
      <OutletComparisonPanel
        outlet={outlet}
        profile={null}
        errorMessage="Perfil no disponible"
      />
    );

    expect(screen.getByText('Alpha Diario')).toBeInTheDocument();
    expect(screen.getByText('Perfil ideológico no disponible')).toBeInTheDocument();
    expect(screen.getByText('Perfil no disponible')).toBeInTheDocument();
  });
});
