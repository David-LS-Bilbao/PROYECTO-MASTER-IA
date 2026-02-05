/**
 * Profile Form Store - Zustand
 * 
 * Sprint 14.5 - Frontend Polish & Robustness
 * Gestión global del estado del formulario de perfil.
 * 
 * Responsabilidades:
 * - Mantener estado del formulario (name, categories, ui flags)
 * - Lógica de toggle de categorías
 * - Sincronización con datos del backend
 * - Reset de cambios
 */

import { create } from 'zustand';

/**
 * Interfaz del estado del store
 */
interface ProfileFormState {
  // Form Fields
  name: string;
  selectedCategories: string[];
  showTokenUsage: boolean;

  // Estado inicial (para reset)
  initialName: string;
  initialCategories: string[];

  // Actions
  setName: (name: string) => void;
  toggleCategory: (category: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  toggleTokenUsage: () => void;
  setInitialState: (profile: { name: string | null; preferences?: { categories?: string[] } }) => void;
  reset: () => void;
  getSavePayload: () => {
    name: string | undefined;
    preferences: {
      categories: string[];
    };
  };
}

/**
 * Store de Zustand para el formulario de perfil
 */
export const useProfileFormStore = create<ProfileFormState>((set, get) => ({
  // Estado inicial
  name: '',
  selectedCategories: [],
  showTokenUsage: false,
  initialName: '',
  initialCategories: [],

  // Actualizar nombre
  setName: (name: string) => set({ name }),

  // Toggle de categoría (add/remove)
  toggleCategory: (category: string) =>
    set((state) => ({
      selectedCategories: state.selectedCategories.includes(category)
        ? state.selectedCategories.filter((c) => c !== category)
        : [...state.selectedCategories, category],
    })),

  // Establecer categorías directamente
  setSelectedCategories: (categories: string[]) =>
    set({ selectedCategories: categories }),

  // Toggle de visibilidad de Token Usage
  toggleTokenUsage: () =>
    set((state) => ({ showTokenUsage: !state.showTokenUsage })),

  // Sincronizar con datos del backend (llamar en useEffect cuando profile carga)
  setInitialState: (profile) => {
    const name = profile.name || '';
    const categories = profile.preferences?.categories || [];

    set({
      name,
      selectedCategories: categories,
      initialName: name,
      initialCategories: categories,
    });
  },

  // Reset a valores iniciales
  reset: () => {
    const { initialName, initialCategories } = get();
    set({
      name: initialName,
      selectedCategories: initialCategories,
      showTokenUsage: false,
    });
  },

  // Preparar payload para guardar en API
  getSavePayload: () => {
    const { name, selectedCategories } = get();
    return {
      name: name || undefined, // API espera undefined si está vacío
      preferences: {
        categories: selectedCategories,
      },
    };
  },
}));
