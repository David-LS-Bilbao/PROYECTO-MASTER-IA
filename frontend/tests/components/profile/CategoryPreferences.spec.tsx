/**
 * Tests para CategoryPreferences - Step 4 Plan Mikado
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryPreferences } from '@/components/profile/CategoryPreferences';

describe('CategoryPreferences', () => {
  const categories = ['Política', 'Economía', 'Tecnología'];

  it('renderiza todas las categorías disponibles', () => {
    render(
      <CategoryPreferences
        availableCategories={categories}
        selectedCategories={[]}
        onToggle={vi.fn()}
      />
    );

    categories.forEach((cat) => {
      expect(screen.getByText(cat)).toBeDefined();
    });
  });

  it('muestra resumen de selección cuando hay categorías seleccionadas', () => {
    render(
      <CategoryPreferences
        availableCategories={categories}
        selectedCategories={['Política', 'Economía']}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText(/2/)).toBeDefined();
    expect(screen.getByText(/Política, Economía/)).toBeDefined();
  });

  it('no muestra resumen cuando no hay categorías seleccionadas', () => {
    render(
      <CategoryPreferences
        availableCategories={categories}
        selectedCategories={[]}
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByText(/categoría\(s\)/)).toBeNull();
  });

  it('llama onToggle al hacer click en una categoría', () => {
    const onToggle = vi.fn();
    render(
      <CategoryPreferences
        availableCategories={categories}
        selectedCategories={[]}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByText('Tecnología'));
    expect(onToggle).toHaveBeenCalledWith('Tecnología');
  });

  it('renderiza el título de la card', () => {
    render(
      <CategoryPreferences
        availableCategories={categories}
        selectedCategories={[]}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('Preferencias de Contenido')).toBeDefined();
  });
});
