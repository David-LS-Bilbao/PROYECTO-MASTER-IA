/**
 * Query Provider - TanStack Query v5
 *
 * FRONTEND MODERNO (Sprint 13 - Fase C + Sprint 16 UX Polish):
 * - Configuración global de React Query optimizada para NEWS APP
 * - Estrategia de "Freshness" agresiva para sentir la app "viva"
 * - Caché inteligente con staleTime adaptativo
 * - Reintentos automáticos en errores transitorios
 * - DevTools habilitados en desarrollo
 *
 * CAMBIOS SPRINT 16:
 * - staleTime reducido de 60s → 30s (noticias deben sentirse frescas)
 * - refetchOnWindowFocus: false → true (actualizar al volver a la pestaña)
 * - refetchOnMount: true → 'always' (siempre verificar al montar/cambiar categoría)
 * - Configuración específica por tipo de query (useNews manejará staleTime por categoría)
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
            // STALE TIME: 30 segundos (reducido de 60s)
            // RAZÓN: News app debe sentirse "viva" y mostrar contenido reciente
            // Queries específicas pueden override este valor (ver useNews.ts)
            staleTime: 30 * 1000, // 30s

            // RETRY: 3 intentos con backoff exponencial
            // Resiliente ante errores transitorios (429, 5xx)
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // REFETCH STRATEGY: Agresiva para freshness
            // ✅ refetchOnWindowFocus: true → Al volver a la pestaña, verificar si hay nuevas noticias
            // ✅ refetchOnMount: 'always' → Cada vez que cambias de categoría, refetchear (incluso si no es stale)
            // ✅ refetchOnReconnect: true → Al reconectar internet, actualizar inmediatamente
            refetchOnWindowFocus: true,  // CAMBIO: false → true (Sprint 16)
            refetchOnMount: 'always',     // CAMBIO: true → 'always' (Sprint 16)
            refetchOnReconnect: true,

            // GARBAGE COLLECTION: Mantener caché 5 minutos
            // Aunque los datos sean "stale", manténlos en memoria por si el usuario vuelve
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
