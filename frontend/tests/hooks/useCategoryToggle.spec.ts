/**
 * Tests para useCategoryToggle Hook - Step 3 Plan Mikado
 *
 * Valida:
 * - Añadir categoría no presente
 * - Eliminar categoría presente (toggle)
 * - reset() restaura estado inicial
 * - clear() vacía todas las selecciones
 * - setSelected() permite inyección externa de estado
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCategoryToggle } from '@/hooks/useCategoryToggle';

describe('useCategoryToggle Hook', () => {
  it('inicializa con las categorías proporcionadas', () => {
    const { result } = renderHook(() =>
      useCategoryToggle(['Política', 'Economía'])
    );

    expect(result.current.selected).toEqual(['Política', 'Economía']);
  });

  it('inicializa vacío sin argumentos', () => {
    const { result } = renderHook(() => useCategoryToggle());

    expect(result.current.selected).toEqual([]);
  });

  it('añade categoría cuando no está presente', () => {
    const { result } = renderHook(() => useCategoryToggle(['Política']));

    act(() => result.current.toggle('Economía'));

    expect(result.current.selected).toEqual(['Política', 'Economía']);
  });

  it('elimina categoría cuando ya está presente', () => {
    const { result } = renderHook(() =>
      useCategoryToggle(['Política', 'Economía'])
    );

    act(() => result.current.toggle('Política'));

    expect(result.current.selected).toEqual(['Economía']);
  });

  it('reset() restaura el estado inicial', () => {
    const { result } = renderHook(() => useCategoryToggle(['Política']));

    act(() => result.current.toggle('Economía'));
    act(() => result.current.toggle('Deportes'));
    expect(result.current.selected).toEqual([
      'Política',
      'Economía',
      'Deportes',
    ]);

    act(() => result.current.reset());
    expect(result.current.selected).toEqual(['Política']);
  });

  it('clear() elimina todas las selecciones', () => {
    const { result } = renderHook(() =>
      useCategoryToggle(['Política', 'Economía'])
    );

    act(() => result.current.clear());

    expect(result.current.selected).toEqual([]);
  });

  it('setSelected() permite inyección externa de estado', () => {
    const { result } = renderHook(() => useCategoryToggle([]));

    act(() =>
      result.current.setSelected(['Tecnología', 'Ciencia'])
    );

    expect(result.current.selected).toEqual(['Tecnología', 'Ciencia']);
  });
});
