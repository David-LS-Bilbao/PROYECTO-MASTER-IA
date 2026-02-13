/**
 * Query Provider - TanStack Query v5 + Persistent Cache
 *
 * FRONTEND MODERNO (Sprint 13 - Fase C + Sprint 29 Performance + Sprint 31 Offline-First):
 * - Configuración global de React Query optimizada para VELOCIDAD PERCIBIDA
 * - Estrategia de "Speed Index" agresiva para navegación instantánea
 * - Caché inteligente con staleTime de 5 minutos (evita spinners redundantes)
 * - Reintentos conservadores para no saturar en errores de red
 * - DevTools habilitados en desarrollo
 *
 * SPRINT 31 (Offline-First / Cold Start Masking):
 * - PersistQueryClientProvider persiste la caché de React Query en localStorage
 * - Al abrir la app, las noticias de la sesión anterior se muestran INSTANTÁNEAMENTE
 * - Mientras tanto, el backend (Render free tier) despierta en segundo plano
 * - Patrón: "Stale-While-Revalidate" con persistencia entre sesiones
 * - maxAge: 24 horas (noticias del día anterior siguen siendo relevantes)
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useState, useMemo } from 'react';

// =============================================================================
// PERSISTENCIA: Configuración del almacenamiento en localStorage
// =============================================================================

/** Tiempo máximo que la caché persistida es válida: 24 horas */
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

/** Prefijo para las claves en localStorage (evita colisiones) */
const PERSIST_STORAGE_KEY = 'verity-news-query-cache';

/**
 * Crea el persister de localStorage de forma segura para SSR.
 * En el servidor (typeof window === 'undefined'), retorna undefined.
 * Solo se instancia en el cliente.
 */
function createPersister() {
  if (typeof window === 'undefined') return undefined;

  return createSyncStoragePersister({
    storage: window.localStorage,
    key: PERSIST_STORAGE_KEY,
  });
}

/**
 * QueryProvider - Wrapper para React Query con Persistencia en localStorage
 *
 * Patrón Singleton para SSR:
 * - useState evita reinicializaciones en re-renders
 * - QueryClient se crea solo una vez por usuario
 * - Persister se crea con useMemo (SSR-safe: solo en cliente)
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
            // GARBAGE COLLECTION TIME: 24 HORAS (Sprint 31: alineado con persistencia)
            // =====================================================================
            // RAZÓN: La caché en memoria debe vivir al menos tanto como la caché
            // persistida en localStorage. Si gcTime < maxAge del persister, los datos
            // se restaurarían del disco pero se eliminarían inmediatamente de memoria.
            gcTime: PERSIST_MAX_AGE, // 24 horas (antes: 30 min)

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
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  // Persister se crea solo en el cliente (SSR-safe)
  const persister = useMemo(() => createPersister(), []);

  // =========================================================================
  // RENDER: PersistQueryClientProvider envuelve la app
  // - Restaura la caché de localStorage al montar
  // - Guarda la caché en localStorage al desmontar/actualizar
  // - Si persister es undefined (SSR), se comporta como QueryClientProvider normal
  // =========================================================================
  if (!persister) {
    // SSR fallback: sin persistencia (primer render en servidor)
    // Esto no debería ocurrir en la práctica porque 'use client' lo previene,
    // pero es un guard seguro que usa el provider estándar sin persistencia.
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
      }}
    >
      {children}
      {/* DevTools: Solo visible en desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </PersistQueryClientProvider>
  );
}
