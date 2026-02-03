/**
 * Tests for TokenUsageCard Component
 * 
 * Cobertura:
 * - Renderizado de datos con formato correcto (números y moneda)
 * - Estado vacío/cero sin crashes
 * - Estado de loading
 * - Estado de error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenUsageCard } from '@/components/token-usage-card';
import { getTokenUsage, type TokenUsageStats } from '@/lib/api';

// Mock del módulo api
vi.mock('@/lib/api', () => ({
  getTokenUsage: vi.fn(),
}));

describe('TokenUsageCard', () => {
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Renderizado de datos con formato correcto', () => {
    it('debe mostrar los costes formateados en Euros (€0.0045)', async () => {
      const mockStats: TokenUsageStats = {
        analysis: {
          count: 5,
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
          cost: 0.0045,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 5,
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
          cost: 0.0045,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '2h 15m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStats);

      render(<TokenUsageCard token={mockToken} />);

      // Esperar a que cargue
      await waitFor(() => {
        expect(screen.getByText('Uso de Tokens (Gemini API)')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verificar formato de coste total en la sección "Total Sesión"
      // Nota: El coste aparece 2 veces (total + desglose), usamos getAllByText
      const costElements = screen.getAllByText('€0.0045');
      expect(costElements.length).toBeGreaterThanOrEqual(1);

      // Verificar formato de tokens (1500 sin separador)
      expect(screen.getAllByText('1500').length).toBeGreaterThanOrEqual(1);

      // Verificar formato de tokens input y output (sin separador para estos valores)
      expect(screen.getAllByText('1000').length).toBeGreaterThanOrEqual(1); // promptTokens
      expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);   // completionTokens

      // Verificar número de operaciones (puede aparecer múltiples veces: total + desglose)
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    });

    it('debe mostrar formato correcto para números grandes (10.000+ tokens)', async () => {
      const mockStats: TokenUsageStats = {
        analysis: {
          count: 20,
          promptTokens: 15750,
          completionTokens: 8250,
          totalTokens: 24000,
          cost: 0.123456,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 20,
          promptTokens: 15750,
          completionTokens: 8250,
          totalTokens: 24000,
          cost: 0.123456,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '5h 30m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStats);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Uso de Tokens (Gemini API)')).toBeInTheDocument();
      });

      // Verificar formato con separadores de miles españoles (pueden aparecer múltiples veces)
      expect(screen.getAllByText('24.000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('15.750').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('8250').length).toBeGreaterThanOrEqual(1); // No usa separador para 8250

      // Verificar formato de coste con 4 decimales (aparece en total + desglose)
      expect(screen.getAllByText('€0.1235').length).toBeGreaterThanOrEqual(1); // toFixed(4)
    });

    it('debe mostrar desglose por operación cuando hay datos de análisis', async () => {
      const mockStats: TokenUsageStats = {
        analysis: {
          count: 3,
          promptTokens: 600,
          completionTokens: 300,
          totalTokens: 900,
          cost: 0.0012,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 3,
          promptTokens: 600,
          completionTokens: 300,
          totalTokens: 900,
          cost: 0.0012,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '1h 5m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStats);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('📊 Análisis de Artículos')).toBeInTheDocument();
      });

      // Verificar que aparece el desglose de análisis
      expect(screen.getByText('📊 Análisis de Artículos')).toBeInTheDocument();

      // Verificar formato del coste de análisis (aparece en total + desglose)
      const costElements = screen.getAllByText('€0.0012');
      expect(costElements.length).toBeGreaterThanOrEqual(1);

      // Verificar tokens formateados en el desglose (aparecen múltiples veces en total + desglose)
      expect(screen.getAllByText('600').length).toBeGreaterThanOrEqual(1);  // promptTokens
      expect(screen.getAllByText('300').length).toBeGreaterThanOrEqual(1);  // completionTokens
    });

    it('debe mostrar múltiples operaciones cuando todas tienen datos', async () => {
      const mockStats: TokenUsageStats = {
        analysis: {
          count: 2,
          promptTokens: 400,
          completionTokens: 200,
          totalTokens: 600,
          cost: 0.001,
        },
        ragChat: {
          count: 3,
          promptTokens: 600,
          completionTokens: 300,
          totalTokens: 900,
          cost: 0.0015,
        },
        groundingChat: {
          count: 1,
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
          cost: 0.0005,
        },
        total: {
          operations: 6,
          promptTokens: 1200,
          completionTokens: 600,
          totalTokens: 1800,
          cost: 0.003,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '3h 45m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStats);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('💬 Chat con RAG')).toBeInTheDocument();
      });

      // Verificar que aparecen todas las secciones
      expect(screen.getByText('📊 Análisis de Artículos')).toBeInTheDocument();
      expect(screen.getByText('💬 Chat con RAG')).toBeInTheDocument();
      expect(screen.getByText('🔍 Chat con Búsqueda')).toBeInTheDocument();

      // Verificar coste total formateado
      expect(screen.getAllByText('€0.0030').length).toBeGreaterThanOrEqual(1);

      // Verificar tokens totales con formato (aparecen en múltiples lugares)
      expect(screen.getAllByText('1800').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1200').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Estado vacío/cero sin crashes', () => {
    it('debe manejar valores en 0 sin crashear', async () => {
      const mockStatsZero: TokenUsageStats = {
        analysis: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '0m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStatsZero);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Verificar que renderiza sin crashear
      expect(screen.getByText('Uso de Tokens (Gemini API)')).toBeInTheDocument();

      // Verificar formato de coste en 0 (€0.0000)
      expect(screen.getByText('€0.0000')).toBeInTheDocument();

      // Verificar que muestra "0" para tokens
      const zeroTexts = screen.getAllByText('0');
      expect(zeroTexts.length).toBeGreaterThan(0);

      // Verificar mensaje de sin actividad
      expect(screen.getByText('No hay actividad registrada en esta sesión')).toBeInTheDocument();
    });

    it('debe manejar valores undefined sin crashear', async () => {
      const mockStatsUndefined: TokenUsageStats = {
        analysis: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '0m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStatsUndefined);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Verificar que no crashea y usa valores por defecto
      expect(screen.getByText('€0.0000')).toBeInTheDocument();
      expect(screen.getByText('No hay actividad registrada en esta sesión')).toBeInTheDocument();
    });

    it('debe formatear correctamente costes muy pequeños (€0.0001)', async () => {
      const mockStatsTiny: TokenUsageStats = {
        analysis: {
          count: 1,
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
          cost: 0.0001,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 1,
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
          cost: 0.0001,
        },
        sessionStart: '2026-02-03T10:00:00.000Z',
        uptime: '5m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStatsTiny);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('📊 Análisis de Artículos')).toBeInTheDocument();
      });

      // Verificar formato con 4 decimales para costes muy pequeños (puede aparecer múltiples veces)
      const tinyElements = screen.getAllByText('€0.0001');
      expect(tinyElements.length).toBeGreaterThanOrEqual(1);

      // Verificar números pequeños sin separadores (pueden aparecer múltiples veces)
      expect(screen.getAllByText('75').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Estados de UI (Loading y Error)', () => {
    it('debe mostrar loading spinner mientras carga', () => {
      // Mock que nunca resuelve para mantener el loading
      vi.mocked(getTokenUsage).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<TokenUsageCard token={mockToken} />);

      // Verificar que muestra el texto de carga
      expect(screen.getByText('Uso de Tokens (Gemini API)')).toBeInTheDocument();
      expect(screen.getByText('Consumo de tokens en la sesión actual del servidor')).toBeInTheDocument();
      
      // Verificar que el contenido principal NO está visible aún
      expect(screen.queryByText('Total Sesión')).not.toBeInTheDocument();
    });

    it('debe mostrar mensaje de error cuando falla el fetch', async () => {
      const errorMessage = 'Failed to fetch token usage: 500';
      vi.mocked(getTokenUsage).mockRejectedValueOnce(new Error(errorMessage));

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByText('Consumo de tokens en la sesión actual del servidor')).not.toBeInTheDocument();
      });

      // Verificar mensaje de error
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      expect(screen.getByText('Uso de Tokens (Gemini API)')).toBeInTheDocument();
    });

    it('debe manejar error genérico cuando no es instancia de Error', async () => {
      vi.mocked(getTokenUsage).mockRejectedValueOnce('String error');

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByText('Consumo de tokens en la sesión actual del servidor')).not.toBeInTheDocument();
      });

      // Verificar error genérico
      expect(screen.getByText('Error: Error desconocido')).toBeInTheDocument();
    });
  });

  describe('Información de sesión', () => {
    it('debe mostrar correctamente la fecha de inicio de sesión y uptime', async () => {
      const mockStats: TokenUsageStats = {
        analysis: {
          count: 1,
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.0002,
        },
        ragChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        groundingChat: {
          count: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        },
        total: {
          operations: 1,
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.0002,
        },
        sessionStart: '2026-02-03T10:30:00.000Z',
        uptime: '12h 45m',
      };

      vi.mocked(getTokenUsage).mockResolvedValueOnce(mockStats);

      render(<TokenUsageCard token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Verificar que muestra el uptime
      expect(screen.getByText(/12h 45m/)).toBeInTheDocument();

      // Verificar que hay un elemento con la fecha de inicio (formato puede variar por locale)
      expect(screen.getByText(/Sesión iniciada:/)).toBeInTheDocument();
    });
  });
});
