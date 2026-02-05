/**
 * Tests para Profile Form Store (Zustand)
 * 
 * Sprint 14.5 - Frontend Polish & Robustness
 * Objetivo: Validar lógica de negocio del formulario de perfil
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProfileFormStore } from '@/stores/profile-form.store';

describe('🏪 ProfileFormStore - Lógica de Negocio', () => {
  beforeEach(() => {
    // Reset completo del store antes de cada test
    useProfileFormStore.setState({
      name: '',
      selectedCategories: [],
      showTokenUsage: false,
      initialName: '',
      initialCategories: [],
    });
  });

  describe('Estado Inicial', () => {
    it('should initialize with default values', () => {
      const state = useProfileFormStore.getState();

      expect(state.name).toBe('');
      expect(state.selectedCategories).toEqual([]);
      expect(state.showTokenUsage).toBe(false);
    });
  });

  describe('Actualización de Nombre', () => {
    it('should update name', () => {
      const { setName } = useProfileFormStore.getState();

      setName('John Doe');

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('John Doe');
    });

    it('should handle empty name', () => {
      const { setName } = useProfileFormStore.getState();

      setName('John Doe');
      setName('');

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('');
    });
  });

  describe('Gestión de Categorías', () => {
    it('should toggle category correctly - ADD', () => {
      const { toggleCategory } = useProfileFormStore.getState();

      toggleCategory('Política');

      const state = useProfileFormStore.getState();
      expect(state.selectedCategories).toContain('Política');
      expect(state.selectedCategories).toHaveLength(1);
    });

    it('should toggle category correctly - REMOVE', () => {
      const { toggleCategory, setSelectedCategories } = useProfileFormStore.getState();

      // Setup: Añade categorías iniciales
      setSelectedCategories(['Política', 'Tecnología']);

      // Action: Quita una categoría
      toggleCategory('Política');

      const state = useProfileFormStore.getState();
      expect(state.selectedCategories).not.toContain('Política');
      expect(state.selectedCategories).toContain('Tecnología');
      expect(state.selectedCategories).toHaveLength(1);
    });

    it('should toggle multiple categories', () => {
      const { toggleCategory } = useProfileFormStore.getState();

      toggleCategory('Política');
      toggleCategory('Economía');
      toggleCategory('Tecnología');

      const state = useProfileFormStore.getState();
      expect(state.selectedCategories).toEqual(['Política', 'Economía', 'Tecnología']);
    });

    it('should handle duplicate toggles (idempotency)', () => {
      const { toggleCategory } = useProfileFormStore.getState();

      toggleCategory('Política');
      toggleCategory('Política'); // Toggle de nuevo (desactivar)

      const state = useProfileFormStore.getState();
      expect(state.selectedCategories).not.toContain('Política');
      expect(state.selectedCategories).toHaveLength(0);
    });
  });

  describe('Sincronización con Perfil del Backend', () => {
    it('should set initial state from user profile', () => {
      const { setInitialState } = useProfileFormStore.getState();

      const mockProfile = {
        name: 'Jane Doe',
        preferences: {
          categories: ['Ciencia', 'Cultura'],
        },
      };

      setInitialState(mockProfile);

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('Jane Doe');
      expect(state.selectedCategories).toEqual(['Ciencia', 'Cultura']);
    });

    it('should handle profile without name (null)', () => {
      const { setInitialState } = useProfileFormStore.getState();

      const mockProfile = {
        name: null,
        preferences: {
          categories: ['Deportes'],
        },
      };

      setInitialState(mockProfile);

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('');
      expect(state.selectedCategories).toEqual(['Deportes']);
    });

    it('should handle profile without preferences', () => {
      const { setInitialState } = useProfileFormStore.getState();

      const mockProfile = {
        name: 'Test User',
        preferences: undefined,
      };

      setInitialState(mockProfile);

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('Test User');
      expect(state.selectedCategories).toEqual([]);
    });
  });

  describe('Reset de Cambios', () => {
    it('should reset to initial state', () => {
      const { setName, toggleCategory, reset } = useProfileFormStore.getState();

      // Modificar estado
      setName('Modified Name');
      toggleCategory('Política');

      // Reset
      reset();

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('');
      expect(state.selectedCategories).toEqual([]);
    });

    it('should reset after initial state was set', () => {
      const { setInitialState, setName, toggleCategory, reset } = useProfileFormStore.getState();

      // Establecer estado inicial
      setInitialState({
        name: 'Original Name',
        preferences: { categories: ['Ciencia'] },
      });

      // Modificar
      setName('New Name');
      toggleCategory('Política');

      // Reset debe volver a valores iniciales
      reset();

      const state = useProfileFormStore.getState();
      expect(state.name).toBe('Original Name');
      expect(state.selectedCategories).toEqual(['Ciencia']);
    });
  });

  describe('Toggle de Visibilidad de Token Usage', () => {
    it('should toggle token usage visibility', () => {
      const { toggleTokenUsage } = useProfileFormStore.getState();

      toggleTokenUsage();

      let state = useProfileFormStore.getState();
      expect(state.showTokenUsage).toBe(true);

      toggleTokenUsage();

      state = useProfileFormStore.getState();
      expect(state.showTokenUsage).toBe(false);
    });
  });

  describe('Datos para Guardar', () => {
    it('should return data ready for API save', () => {
      const { setName, toggleCategory, getSavePayload } = useProfileFormStore.getState();

      setName('Save Test');
      toggleCategory('Economía');
      toggleCategory('Tecnología');

      const payload = getSavePayload();

      expect(payload).toEqual({
        name: 'Save Test',
        preferences: {
          categories: ['Economía', 'Tecnología'],
        },
      });
    });

    it('should return undefined for empty name (API expects undefined)', () => {
      const { setName, getSavePayload } = useProfileFormStore.getState();

      setName('');

      const payload = getSavePayload();

      expect(payload.name).toBeUndefined();
    });
  });
});
