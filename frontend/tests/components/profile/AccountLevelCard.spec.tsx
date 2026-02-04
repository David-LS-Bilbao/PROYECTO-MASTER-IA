/**
 * Tests para AccountLevelCard - Step 4 Plan Mikado
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountLevelCard } from '@/components/profile/AccountLevelCard';

describe('AccountLevelCard', () => {
  const defaultProps = {
    articlesAnalyzed: 25,
    plan: 'FREE' as const,
    createdAt: '2026-01-15T00:00:00Z',
    userId: 'abcdefghij1234567890extra',
  };

  it('muestra el progreso de análisis', () => {
    render(<AccountLevelCard {...defaultProps} />);

    expect(screen.getByText('25 / 50')).toBeDefined();
    expect(screen.getByText('Quedan 25 análisis este mes')).toBeDefined();
  });

  it('muestra mensaje de límite alcanzado al llegar a 50', () => {
    render(<AccountLevelCard {...defaultProps} articlesAnalyzed={50} />);

    expect(screen.getByText('Has alcanzado el límite mensual')).toBeDefined();
  });

  it('muestra la fecha de creación formateada', () => {
    render(<AccountLevelCard {...defaultProps} />);

    expect(screen.getByText('Miembro desde')).toBeDefined();
    // La fecha se formatea en es-ES
    expect(screen.getByText(/15 de enero de 2026/)).toBeDefined();
  });

  it('muestra el ID de usuario truncado', () => {
    render(<AccountLevelCard {...defaultProps} />);

    expect(screen.getByText('abcdefghij1234567890...')).toBeDefined();
  });

  it('renderiza el título de la card', () => {
    render(<AccountLevelCard {...defaultProps} />);

    expect(screen.getByText('Nivel de Cuenta')).toBeDefined();
  });
});
