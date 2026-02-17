'use client';

import { useEffect, useState } from 'react';
import { ScrollToTop } from '@/components/ui/scroll-to-top';

/**
 * Evita hydration mismatch por extensiones (ej: Dark Reader) que mutan el SVG
 * antes de hidratar. Renderiza el botón solo tras mount en cliente.
 */
export function ClientOnlyScrollToTop() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <ScrollToTop />;
}
