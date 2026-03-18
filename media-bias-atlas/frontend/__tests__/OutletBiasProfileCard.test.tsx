import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OutletBiasProfileCard } from '@/components/OutletBiasProfileCard';
import { OutletBiasProfile } from '@/types';

const baseProfile: OutletBiasProfile = {
  outletId: 'outlet-1',
  status: 'ANALYZED',
  totalPoliticalArticles: 24,
  totalCompletedAnalyses: 12,
  minimumSampleRequired: 5,
  dominantLabel: 'CENTER_LEFT',
  distribution: {
    LEFT: 1,
    CENTER_LEFT: 5,
    CENTER: 3,
    CENTER_RIGHT: 2,
    RIGHT: 1,
    UNCLEAR: 0,
  },
};

describe('OutletBiasProfileCard', () => {
  it('muestra aviso cuando el perfil no se pudo cargar', () => {
    render(<OutletBiasProfileCard profile={null} errorMessage="Backend no disponible" />);

    expect(screen.getByText('Perfil ideológico no disponible')).toBeInTheDocument();
    expect(screen.getByText('Backend no disponible')).toBeInTheDocument();
  });

  it('muestra estado de muestra insuficiente cuando no hay datos suficientes', () => {
    render(
      <OutletBiasProfileCard
        profile={{
          ...baseProfile,
          status: 'INSUFFICIENT_DATA',
          totalCompletedAnalyses: 3,
          dominantLabel: null,
        }}
      />
    );

    expect(screen.getByText('Muestra insuficiente')).toBeInTheDocument();
    expect(screen.getByText(/Se necesitan al menos 5 análisis completados/i)).toBeInTheDocument();
  });

  it('muestra el perfil ideológico válido y la etiqueta dominante', () => {
    render(<OutletBiasProfileCard profile={baseProfile} />);

    expect(screen.getByText('Perfil ideológico del medio')).toBeInTheDocument();
    expect(screen.getByText('Perfil disponible')).toBeInTheDocument();
    expect(screen.getAllByText('Centro-izquierda')).toHaveLength(2);
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
