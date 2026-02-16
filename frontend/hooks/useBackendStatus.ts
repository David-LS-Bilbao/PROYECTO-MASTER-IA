/**
 * useBackendStatus - Backend Availability Guard
 *
 * Detecta si el backend está disponible o despertando (Render free tier cold start).
 * Pings /health/check con timeout corto (8s) para determinar el estado rápido,
 * en lugar de esperar 45s del fetchWithTimeout de las llamadas normales.
 *
 * Estados:
 * - checking: Primer ping en curso
 * - warming: Backend no responde, reintentando cada 5s
 * - ready: Backend disponible
 * - down: Backend no responde tras múltiples reintentos
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type BackendStatus = 'checking' | 'warming' | 'ready' | 'down';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${API_BASE_URL}/health/check`;
const PING_TIMEOUT = 8_000; // 8s - suficiente para respuesta normal, falla rápido en cold start
const RETRY_INTERVAL = 5_000; // 5s entre reintentos
const MAX_RETRIES = 4; // ~28s total (checking + 4 retries × 5s)

interface UseBackendStatusReturn {
  status: BackendStatus;
  retryCount: number;
  retry: () => void;
}

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

export function useBackendStatus(): UseBackendStatusReturn {
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

    // Backend no responde
    if (!isRetry) {
      // Primer fallo → warming
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

  // Retry manual (resetea el ciclo)
  const retry = useCallback(() => {
    setStatus('checking');
    setRetryCount(0);
    check(false);
  }, [check]);

  return { status, retryCount, retry };
}
