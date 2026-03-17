import React from 'react';

export function Loader({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div className="w-8 h-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-primary rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-500 text-sm font-medium animate-pulse">{message}</p>
    </div>
  );
}
