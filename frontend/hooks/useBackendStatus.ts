/**
 * useBackendStatus - Backend Availability Guard (Context-based)
 *
 * Detecta si el backend está disponible o despertando (Render free tier cold start).
 * Implementado como Context para compartir estado entre todos los hooks de React Query.
 *
 * Estados:
 * - checking: Primer ping en curso
 * - warming: Backend no responde, reintentando cada 5s
 * - ready: Backend disponible
 * - down: Backend no responde tras múltiples reintentos
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type BackendStatus = 'checking' | 'warming' | 'ready' | 'down';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${API_BASE_URL}/health/check`;
const PING_TIMEOUT = 8_000;
const RETRY_INTERVAL = 5_000;
const MAX_RETRIES = 4;

interface BackendStatusContextType {
  status: BackendStatus;
  retryCount: number;
  retry: () => void;
  isReady: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);

  try {
    const res = await fetch(HEALTH_ENDPOINT, {
      signal: controller.signal,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  const check = useCallback(async (isRetry = false) => {
    if (!mountedRef.current) return;

    const ok = await pingHealth();
    if (!mountedRef.current) return;

    if (ok) {
      setStatus('ready');
      setRetryCount(0);
      return;
    }

    if (!isRetry) {
      setStatus('warming');
      setRetryCount(1);
    } else {
      setRetryCount((prev) => {
        const next = prev + 1;
        if (next > MAX_RETRIES) {
          setStatus('down');
        }
        return next;
      });
    }
  }, []);

  // Auto-retry cuando está en warming
  useEffect(() => {
    if (status !== 'warming') return;

    retryTimerRef.current = setTimeout(() => {
      check(true);
    }, RETRY_INTERVAL);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [status, retryCount, check]);

  // Ping inicial al montar
  useEffect(() => {
    mountedRef.current = true;
    check(false);

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [check]);

  const retry = useCallback(() => {
    setStatus('checking');
    setRetryCount(0);
    check(false);
  }, [check]);

  const value: BackendStatusContextType = {
    status,
    retryCount,
    retry,
    isReady: status === 'ready',
  };

  return React.createElement(BackendStatusContext.Provider, { value }, children);
}

/**
 * Hook para consumir el estado del backend desde cualquier componente/hook.
 * Debe usarse dentro de BackendStatusProvider.
 */
export function useBackendStatus(): BackendStatusContextType {
  const context = useContext(BackendStatusContext);
  if (context === undefined) {
    throw new Error('useBackendStatus debe usarse dentro de BackendStatusProvider');
  }
  return context;
}
