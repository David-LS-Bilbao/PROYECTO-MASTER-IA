import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReliabilityBadge } from '@/components/reliability-badge';

describe('ReliabilityBadge vNext.1', () => {
  it('muestra "No verificable con fuentes internas" cuando factualityStatus=no_determinable', () => {
    render(
      <ReliabilityBadge
        score={15}
        traceabilityScore={10}
        clickbaitScore={20}
        factualityStatus="no_determinable"
        shouldEscalate={false}
      />
    );

    expect(
      screen.getByText('No verificable con fuentes internas')
    ).toBeInTheDocument();
    expect(screen.queryByText('Posible bulo / alto riesgo')).not.toBeInTheDocument();
  });

  it('muestra "Posible bulo / alto riesgo" solo con condicion estricta', () => {
    const { rerender } = render(
      <ReliabilityBadge
        score={19}
        traceabilityScore={19}
        clickbaitScore={60}
        factualityStatus="plausible_but_unverified"
        shouldEscalate={false}
      />
    );

    expect(screen.getByText('Posible bulo / alto riesgo')).toBeInTheDocument();

    rerender(
      <ReliabilityBadge
        score={19}
        traceabilityScore={21}
        clickbaitScore={80}
        factualityStatus="plausible_but_unverified"
        shouldEscalate={true}
      />
    );

    expect(screen.queryByText('Posible bulo / alto riesgo')).not.toBeInTheDocument();
  });
});
