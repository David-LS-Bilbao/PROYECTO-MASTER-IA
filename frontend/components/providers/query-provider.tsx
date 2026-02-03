/**
 * Query Provider - TanStack Query v5
 * 
 * FRONTEND MODERNO (Sprint 13 - Fase C):
 * - Configuración global de React Query
 * - Caché inteligente con staleTime de 60s
 * - Reintentos automáticos en errores transitorios
 * - DevTools habilitados en desarrollo
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

/**
 * QueryProvider - Wrapper para React Query
 * 
 * Patrón Singleton para SSR:
 * - useState evita reinicializaciones en re-renders
 * - QueryClient se crea solo una vez por usuario
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Inicialización lazy del QueryClient (solo una vez)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // STALE TIME: 60 segundos
            // Las noticias no cambian cada milisegundo
            // Evita refetches innecesarios durante navegación
            staleTime: 60 * 1000, // 60s

            // RETRY: 3 intentos con backoff exponencial
            // Resiliente ante errores transitorios (429, 5xx)
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // REFETCH: Solo cuando el usuario interactúa
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            refetchOnReconnect: true,

            // GARBAGE COLLECTION: Mantener caché 5 minutos
            gcTime: 5 * 60 * 1000, // 5min (antes cacheTime)
          },
          mutations: {
            // Reintentos para mutaciones (POST/PUT/DELETE)
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools: Solo visible en desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
