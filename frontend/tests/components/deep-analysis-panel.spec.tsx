import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeepAnalysisPanel } from '@/components/deep-analysis-panel';

describe('DeepAnalysisPanel', () => {
  it('renders deep sections when provided', () => {
    render(
      <DeepAnalysisPanel
        sections={{
          known: ['Dato confirmado'],
          unknown: ['Falta documento base'],
          quotes: ['"Cita breve del articulo"'],
          risks: ['Riesgo de sobregeneralizacion'],
        }}
      />
    );

    expect(screen.getByText('Analisis profundo')).toBeInTheDocument();
    expect(screen.getByText('Que sabemos')).toBeInTheDocument();
    expect(screen.getByText('Dato confirmado')).toBeInTheDocument();
    expect(screen.getByText('Que no sabemos')).toBeInTheDocument();
    expect(screen.getByText('Falta documento base')).toBeInTheDocument();
    expect(screen.getByText('Citas del articulo')).toBeInTheDocument();
    expect(screen.getByText('"Cita breve del articulo"')).toBeInTheDocument();
    expect(screen.getByText('Riesgos de interpretacion')).toBeInTheDocument();
    expect(screen.getByText('Riesgo de sobregeneralizacion')).toBeInTheDocument();
  });
});
