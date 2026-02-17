/**
 * Global Loading Skeleton - Next.js App Router
 *
 * Sprint 31: Se muestra durante la hidratación inicial de la app.
 * Pinta la estructura base (sidebar + header + grid de cards) para que
 * la pantalla NUNCA quede en blanco/negro al cargar la URL.
 *
 * Esto es complementario a la caché persistente de React Query:
 * - loading.tsx cubre el primer milisegundo de hidratación de Next.js
 * - PersistQueryClientProvider restaura los datos reales desde localStorage
 * - El backend despierta en segundo plano (Stale-While-Revalidate)
 */

export default function Loading() {
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar Skeleton (desktop only) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Logo area */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="h-7 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>

        {/* Nav items */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
            >
              <div className="h-5 w-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div
                className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Skeleton */}
        <header className="border-b border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <div className="lg:hidden h-9 w-9 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
              {/* Brand */}
              <div className="h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              {/* Search bar */}
              <div className="flex-1 max-w-2xl h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
              {/* Stats */}
              <div className="hidden lg:flex items-center gap-3">
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Grid Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8">
            {/* Section title */}
            <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
              <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>

            {/* News Cards Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  {/* Image placeholder */}
                  <div className="h-48 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-4/5" />
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-3/5" />
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-3 w-3 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
                      <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
