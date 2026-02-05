'use client';

import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorCard } from '@/components/ui/error-card';
import { captureSentryException } from '@/sentry.client.config'; // Sprint 15: Sentry error tracking

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * GlobalErrorBoundary - Red de seguridad para errores de React
 * 
 * CARACTERÍSTICAS:
 * - Captura errores no controlados en el árbol de componentes
 * - Muestra UI de degradación elegante (ErrorCard)
 * - Integra con React Query para limpiar caché en retry
 * - Previene "White Screen of Death"
 * 
 * CASOS DE USO:
 * - Error en render de componente (ej: acceso a undefined.property)
 * - Error en useEffect sin try-catch
 * - Error en event handlers sin capturar
 * 
 * @example
 * ```tsx
 * // layout.tsx
 * <GlobalErrorBoundary>
 *   <App />
 * </GlobalErrorBoundary>
 * ```
 */
export function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const queryClient = useQueryClient();

  /**
   * Fallback UI cuando un componente falla
   */
  const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
    // Sanitizar mensaje de error para evitar exponer detalles técnicos
    const userMessage = String(error).includes('fetch')
      ? 'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
      : 'Ocurrió un error inesperado. Intenta recargar la página.';

    return (
      <ErrorCard
        title="Error en la aplicación"
        message={userMessage}
        resetErrorBoundary={resetErrorBoundary}
      />
    );
  };

  /**
   * Handler para el botón "Reintentar"
   * 
   * ACCIONES:
   * 1. Limpiar caché de React Query (queries inválidas)
   * 2. Re-renderizar el árbol de componentes
   */
  const handleReset = () => {
    // Limpiar todas las queries de React Query
    queryClient.resetQueries();
    
    // Log para debugging (solo desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Error Boundary: Reseteando queries y re-renderizando...');
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleReset}
      onError={(error, info) => {
        // Log del error para debugging (solo desarrollo)
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error Boundary capturó un error:', error);
          console.error('📍 Component Stack:', info.componentStack);
        }

        // 🔍 Sprint 15: Capture error in Sentry for production monitoring
        captureSentryException(error, {
          errorBoundary: true,
          componentStack: info.componentStack,
          source: 'GlobalErrorBoundary',
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
