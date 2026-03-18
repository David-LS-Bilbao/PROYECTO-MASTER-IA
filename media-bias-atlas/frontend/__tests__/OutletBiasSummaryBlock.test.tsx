import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OutletBiasSummaryBlock } from '@/components/OutletBiasSummaryBlock';

describe('OutletBiasSummaryBlock', () => {
  it('muestra fallback cuando no hay resumen', () => {
    render(<OutletBiasSummaryBlock summary={null} />);

    expect(screen.getByText('Perfil ideológico no disponible')).toBeInTheDocument();
  });

  it('muestra estado de muestra insuficiente', () => {
    render(
      <OutletBiasSummaryBlock
        summary={{
          status: 'INSUFFICIENT_DATA',
          dominantLabel: null,
          totalPoliticalArticles: 3,
          totalCompletedAnalyses: 2,
        }}
      />
    );

    expect(screen.getByText('Muestra insuficiente')).toBeInTheDocument();
    expect(screen.getByText(/2 análisis completados/i)).toBeInTheDocument();
  });

  it('muestra etiqueta dominante cuando el perfil ya está disponible', () => {
    render(
      <OutletBiasSummaryBlock
        summary={{
          status: 'ANALYZED',
          dominantLabel: 'CENTER_RIGHT',
          totalPoliticalArticles: 10,
          totalCompletedAnalyses: 8,
        }}
      />
    );

    expect(screen.getByText('Perfil disponible')).toBeInTheDocument();
    expect(screen.getByText('Centro-derecha')).toBeInTheDocument();
    expect(screen.getByText(/8 análisis completados/i)).toBeInTheDocument();
  });
});
