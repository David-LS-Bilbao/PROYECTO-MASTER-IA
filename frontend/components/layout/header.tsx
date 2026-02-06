'use client';

import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { SearchBar } from '@/components/search-bar';

/**
 * Header Component - Google News Style
 *
 * Features:
 * - Logo/Brand on the left
 * - Search bar in the center
 * - Sticky positioning
 * - Responsive design
 *
 * Sprint 19: Integración con Waterfall Search
 */

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="container flex h-16 items-center px-4">
        {/* Logo/Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 mr-6 shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <img src="/favicon.ico" alt="Logo Verity News" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-bold text-lg text-zinc-900 dark:text-white hidden sm:inline-block">
            Verity News
          </span>
        </Link>

        {/* Search Bar - Center/Flexible */}
        <div className="flex-1 max-w-2xl mx-auto">
          <SearchBar
            placeholder="Buscar temas, noticias..."
            className="w-full"
          />
        </div>

        {/* Spacer for balance (optional) */}
        <div className="w-6 shrink-0 hidden sm:block" />
      </div>
    </header>
  );
}
