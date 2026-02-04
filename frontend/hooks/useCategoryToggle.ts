/**
 * useCategoryToggle - Step 3 Plan Mikado
 *
 * Hook para gestionar selección múltiple de categorías.
 * Reutilizable en: perfil, filtros de búsqueda, preferencias.
 */

import { useState } from 'react';

export function useCategoryToggle(initialCategories: string[] = []) {
  const [selected, setSelected] = useState<string[]>(initialCategories);

  const toggle = (category: string) => {
    setSelected((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const reset = () => setSelected(initialCategories);

  const clear = () => setSelected([]);

  return { selected, toggle, reset, clear, setSelected };
}
