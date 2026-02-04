/**
 * Tests para UsageStatsCard - Step 4 Plan Mikado
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageStatsCard } from '@/components/profile/UsageStatsCard';

describe('UsageStatsCard', () => {
  it('renderiza las 4 estadísticas correctamente', () => {
    render(
      <UsageStatsCard
        articlesAnalyzed={15}
        searchesPerformed={8}
        chatMessages={3}
        favorites={5}
      />
    );

    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renderiza los labels correctos', () => {
    render(
      <UsageStatsCard
        articlesAnalyzed={0}
        searchesPerformed={0}
        chatMessages={0}
        favorites={0}
      />
    );

    expect(screen.getByText('Noticias Analizadas')).toBeDefined();
    expect(screen.getByText('Búsquedas')).toBeDefined();
    expect(screen.getByText('Mensajes Chat')).toBeDefined();
    expect(screen.getByText('Favoritos')).toBeDefined();
  });

  it('renderiza el título de la card', () => {
    render(
      <UsageStatsCard
        articlesAnalyzed={0}
        searchesPerformed={0}
        chatMessages={0}
        favorites={0}
      />
    );

    expect(screen.getByText('Consumo de IA')).toBeDefined();
  });
});
