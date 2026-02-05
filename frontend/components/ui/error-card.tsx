'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorCardProps {
  title?: string;
  message?: string;
  retry?: () => void;
  resetErrorBoundary?: () => void;
}

/**
 * ErrorCard - Componente de UI para mostrar errores elegantemente
 * 
 * Usado por Error Boundaries para degradación visual elegante.
 * Evita "White Screen of Death" cuando un componente falla.
 * 
 * @example
 * ```tsx
 * <ErrorCard
 *   title="Error al cargar el perfil"
 *   message="No se pudo conectar con el servidor"
 *   retry={() => window.location.reload()}
 * />
 * ```
 */
export function ErrorCard({
  title = 'Algo salió mal',
  message,
  retry,
  resetErrorBoundary,
}: ErrorCardProps) {
  const handleRetry = () => {
    // Prioriza retry explícito, si no usa resetErrorBoundary
    if (retry) {
      retry();
    } else if (resetErrorBoundary) {
      resetErrorBoundary();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-red-200 dark:border-red-800">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-semibold text-red-900 dark:text-red-100">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {message && (
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          
          <div className="flex flex-col gap-2">
            {(retry || resetErrorBoundary) && (
              <Button onClick={handleRetry} variant="default">
                Reintentar
              </Button>
            )}
            
            <Button variant="outline" asChild>
              <a href="/">Volver al inicio</a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Si el problema persiste, contacta con soporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
