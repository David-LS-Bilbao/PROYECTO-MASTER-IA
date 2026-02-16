/**
 * WarmUpBanner - Indicador de disponibilidad del backend
 *
 * Muestra un banner/pantalla cuando el backend de Render está despertando.
 * Dos modos:
 * - Banner (inline): se muestra sobre el contenido cacheado
 * - FullScreen: reemplaza el skeleton cuando no hay cache
 */

'use client';

import { useEffect, useState } from 'react';
import type { BackendStatus } from '@/hooks/useBackendStatus';

interface WarmUpBannerProps {
  status: BackendStatus;
  retryCount: number;
  onRetry: () => void;
  fullScreen?: boolean;
}

/** Barra de progreso animada que simula el avance del cold start */
function ProgressBar({ retryCount }: { retryCount: number }) {
  // Progreso estimado: cada retry ~20%, máximo 90% hasta ready
  const progress = Math.min(retryCount * 22, 90);

  return (
    <div className="w-full max-w-xs bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Banner compacto (top de la pagina) */
function InlineBanner({ status, retryCount, onRetry }: WarmUpBannerProps) {
  const [visible, setVisible] = useState(true);

  // Auto-ocultar cuando pasa a ready
  useEffect(() => {
    if (status === 'ready') {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [status]);

  if (!visible) return null;

  if (status === 'ready') {
    return (
      <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-4 py-2 text-center transition-opacity duration-500">
        <span className="text-sm text-green-700 dark:text-green-300 font-medium">
          Servidor conectado
        </span>
      </div>
    );
  }

  if (status === 'down') {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-3 text-center">
        <p className="text-sm text-red-700 dark:text-red-300 font-medium">
          No se pudo conectar al servidor
        </p>
        <button
          onClick={onRetry}
          className="mt-1 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
        >
          Reintentar conexion
        </button>
      </div>
    );
  }

  // warming
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent" />
          <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Despertando servidor... (~30s)
          </span>
        </div>
        <ProgressBar retryCount={retryCount} />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Mostrando datos guardados mientras tanto
        </p>
      </div>
    </div>
  );
}

/** Pantalla completa cuando no hay cache */
function FullScreenWarmUp({ status, retryCount, onRetry }: WarmUpBannerProps) {
  if (status === 'down') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-6xl mb-6">🔌</div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
          Servidor no disponible
        </h2>
        <p className="text-muted-foreground mb-6">
          No se pudo establecer conexion con el servidor.
          Puede estar en mantenimiento o experimentando problemas.
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // checking o warming
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="text-6xl mb-6">☕</div>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
        Despertando el servidor...
      </h2>
      <p className="text-muted-foreground mb-6">
        El servidor gratuito se pone en reposo tras inactividad.
        Estamos despertandolo, suele tardar unos 30 segundos.
      </p>

      {/* Barra de progreso */}
      <div className="flex justify-center mb-4">
        <ProgressBar retryCount={retryCount} />
      </div>

      {/* Spinner + estado */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
        <span>
          {status === 'checking'
            ? 'Comprobando disponibilidad...'
            : `Intento ${retryCount} de 4...`}
        </span>
      </div>
    </div>
  );
}

export function WarmUpBanner(props: WarmUpBannerProps) {
  if (props.fullScreen) {
    return <FullScreenWarmUp {...props} />;
  }
  return <InlineBanner {...props} />;
}
