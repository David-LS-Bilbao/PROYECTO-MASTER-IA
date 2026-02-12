/**
 * Query Provider - TanStack Query v5
 *
 * FRONTEND MODERNO (Sprint 13 - Fase C + Sprint 29 Performance):
 * - Configuración global de React Query optimizada para VELOCIDAD PERCIBIDA
 * - Estrategia de "Speed Index" agresiva para navegación instantánea
 * - Caché inteligente con staleTime de 5 minutos (evita spinners redundantes)
 * - Reintentos conservadores para no saturar en errores de red
 * - DevTools habilitados en desarrollo
 *
 * CAMBIOS SPRINT 29 (Performance Optimization):
 * - staleTime: 30s → 5min (las noticias no cambian cada segundo, evita refetches)
 * - refetchOnWindowFocus: true → false (no molestar al cambiar de pestaña)
 * - refetchOnMount: 'always' → true (solo refetch si stale, no SIEMPRE)
 * - gcTime: 5min → 30min (mantener caché más tiempo para mejor UX)
 * - retry: 3 → 1 (un solo reintento para no saturar)
 *
 * OBJETIVO: App "snappy" donde el usuario casi nunca ve spinners de carga
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
            // =====================================================================
            // STALE TIME: 5 MINUTOS (optimización Sprint 29)
            // =====================================================================
            // RAZÓN: Las noticias NO cambian cada segundo. Si el usuario vuelve
            // a la Home en menos de 5 minutos, mostramos datos de MEMORIA
            // INSTANTÁNEAMENTE sin hacer ningún fetch al servidor.
            // RESULTADO: Navegación "snappy", sin spinners molestos.
            staleTime: 1000 * 60 * 5, // 5 minutos

            // =====================================================================
            // GARBAGE COLLECTION TIME: 30 MINUTOS
            // =====================================================================
            // RAZÓN: Mantén los datos en caché (memoria) durante media hora aunque
            // no se estén usando activamente. Si el usuario vuelve, carga instantánea.
            gcTime: 1000 * 60 * 30, // 30 minutos

            // =====================================================================
            // RETRY: 1 reintento (reducido de 3)
            // =====================================================================
            // RAZÓN: Si falla, reintenta solo UNA vez para no saturar el servidor
            // en casos de problemas de conexión o rate limiting (429).
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // =====================================================================
            // REFETCH STRATEGY: Conservadora para velocidad percibida
            // =====================================================================
            // ❌ refetchOnWindowFocus: false → No refetchear al cambiar de pestaña
            //    (molesto para el usuario, solo refetch si los datos están stale)
            // ✅ refetchOnMount: true → Solo refetch si datos stale (NO siempre)
            // ✅ refetchOnReconnect: true → Al reconectar internet, actualizar
            refetchOnWindowFocus: false, // CAMBIO: true → false (Sprint 29)
            refetchOnMount: true,         // CAMBIO: 'always' → true (Sprint 29)
            refetchOnReconnect: true,
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
