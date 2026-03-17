'use client';

import { useEffect } from 'react';
import { Alert } from '@/components/ui/Alert';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Aquí se podría integrar Sentry si aplicara
    console.error(error);
  }, [error]);

  return (
    <div className="py-12 max-w-2xl mx-auto">
      <Alert 
        title="Ocurrió un error inesperado" 
        message={error.message || "No se pudo comunicar con el servidor."} 
        type="error" 
      />
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm font-medium transition-colors"
        >
          Intentar nuevamente
        </button>
      </div>
    </div>
  );
}
