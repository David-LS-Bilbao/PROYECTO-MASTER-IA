/**
 * DateSeparator Component (Sprint 19.5 - Tarea 2: Separadores de Fecha)
 *
 * Separador visual que agrupa noticias por fecha de publicación
 * Muestra etiquetas como "Hoy", "Ayer", o la fecha formateada
 */

import React from 'react';

interface DateSeparatorProps {
  label: string;
  articleCount?: number;
}

export function DateSeparator({ label, articleCount }: DateSeparatorProps) {
  return (
    <div className="col-span-full max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 my-8">
        {/* Left Line */}
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-zinc-300 dark:to-zinc-700"></div>

        {/* Date Label */}
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm">
          <svg
            className="w-4 h-4 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>

          <span className="text-sm font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
            {label}
          </span>

          {articleCount !== undefined && (
            <span className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {articleCount} {articleCount === 1 ? 'noticia' : 'noticias'}
            </span>
          )}
        </div>

        {/* Right Line */}
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-zinc-300 dark:via-zinc-700 to-zinc-300 dark:to-zinc-700"></div>
      </div>
    </div>
  );
}
