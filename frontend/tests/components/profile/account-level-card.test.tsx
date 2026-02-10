import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountLevelCard } from '@/components/profile/AccountLevelCard';

const mockProps = {
  articlesAnalyzed: 25,
  plan: 'FREE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'test-user-123456789',
};

describe('AccountLevelCard', () => {
  it('renderiza correctamente con datos basicos', () => {
    render(<AccountLevelCard {...mockProps} />);

    expect(screen.getByText('Nivel de Cuenta')).toBeInTheDocument();
    expect(screen.getByText('25 / 50')).toBeInTheDocument();
    expect(screen.getByText('Quedan 25 analisis este mes')).toBeInTheDocument();
  });

  it('muestra mensaje cuando alcanza el limite', () => {
    render(<AccountLevelCard {...mockProps} articlesAnalyzed={50} />);

    expect(screen.getByText('Has alcanzado el limite mensual')).toBeInTheDocument();
  });

  it('calcula correctamente el porcentaje de uso', () => {
    const { container } = render(<AccountLevelCard {...mockProps} articlesAnalyzed={25} />);

    // 25/50 = 50%
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('formatea correctamente la fecha de creacion', () => {
    render(<AccountLevelCard {...mockProps} />);

    // Debe mostrar la fecha en formato espanol
    expect(screen.getByText(/1 de enero de 2026/i)).toBeInTheDocument();
  });

  it('muestra el ID de usuario truncado', () => {
    render(<AccountLevelCard {...mockProps} />);

    expect(screen.getByText(/test-user-123456789.../)).toBeInTheDocument();
  });

  describe('Boton de toggle de tokens', () => {
    it('NO muestra el boton cuando no se pasa onShowTokenUsage', () => {
      render(<AccountLevelCard {...mockProps} />);

      expect(screen.queryByText('Ver Uso de Tokens')).not.toBeInTheDocument();
      expect(screen.queryByText('Ocultar Uso de Tokens')).not.toBeInTheDocument();
    });

    it('muestra "Ver Uso de Tokens" cuando showingTokenUsage es false', () => {
      const onShowTokenUsage = vi.fn();
      render(
        <AccountLevelCard
          {...mockProps}
          onShowTokenUsage={onShowTokenUsage}
          showingTokenUsage={false}
        />
      );

      expect(screen.getByText('Ver Uso de Tokens')).toBeInTheDocument();
    });

    it('muestra "Ocultar Uso de Tokens" cuando showingTokenUsage es true', () => {
      const onShowTokenUsage = vi.fn();
      render(
        <AccountLevelCard
          {...mockProps}
          onShowTokenUsage={onShowTokenUsage}
          showingTokenUsage={true}
        />
      );

      expect(screen.getByText('Ocultar Uso de Tokens')).toBeInTheDocument();
    });

    it('llama a onShowTokenUsage al hacer click en el boton', () => {
      const onShowTokenUsage = vi.fn();
      render(
        <AccountLevelCard
          {...mockProps}
          onShowTokenUsage={onShowTokenUsage}
          showingTokenUsage={false}
        />
      );

      const button = screen.getByText('Ver Uso de Tokens');
      fireEvent.click(button);

      expect(onShowTokenUsage).toHaveBeenCalledTimes(1);
    });
  });
});
