'use client';

import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'general', label: '🔥 Portada' },
  { id: 'favorites', label: '❤️ Favoritos' },
  { id: 'deportes', label: '⚽ Deportes' },
  { id: 'economia', label: '💰 Economía' },
  { id: 'politica', label: '⚖️ Política' },
  { id: 'tecnologia', label: '📱 Tecnología' },
  { id: 'ciencia', label: '🧬 Ciencia' },
  { id: 'cultura', label: '🎬 Cultura' },
  { id: 'internacional', label: '🌍 Mundo' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

interface CategoryPillsProps {
  selectedCategory: string;
  onSelect: (category: CategoryId) => void;
  disabled?: boolean;
}

export function CategoryPills({ selectedCategory, onSelect, disabled = false }: CategoryPillsProps) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-2 min-w-max">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            disabled={disabled}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selectedCategory === cat.id
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { CATEGORIES };
