'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Test Page - Página de prueba para Error Boundaries
 * 
 * SOLO PARA DESARROLLO. Eliminar antes de producción.
 * 
 * Ruta: /test-error
 * 
 * CASOS DE PRUEBA:
 * 1. Throw inmediato en render
 * 2. Throw en event handler
 * 3. Throw asíncrono (Promise rejection)
 */
export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    // ❌ Error sincrónico en render (capturado por Error Boundary)
    throw new Error('💥 Test Error: Componente falló intencionalmente');
  }

  const handleAsyncError = async () => {
    // ❌ Error asíncrono (NO capturado por Error Boundary tradicional)
    // Requiere try-catch manual o usar React Query
    await new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Async error')), 100)
    );
  };

  const handleEventError = () => {
    // ❌ Error en event handler (capturado por Error Boundary)
    throw new Error('💥 Test Error: Event handler falló');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>🧪 Test de Error Boundaries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Prueba los diferentes tipos de errores para verificar que el Error Boundary funciona.
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => setShouldThrow(true)}
              variant="destructive"
              className="w-full"
            >
              💣 Lanzar Error en Render
            </Button>

            <Button
              onClick={handleEventError}
              variant="destructive"
              className="w-full"
            >
              💥 Lanzar Error en Event Handler
            </Button>

            <Button
              onClick={handleAsyncError}
              variant="outline"
              className="w-full"
            >
              ⏳ Lanzar Error Asíncrono (no capturado)
            </Button>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Solo para desarrollo. Eliminar antes de producción.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
