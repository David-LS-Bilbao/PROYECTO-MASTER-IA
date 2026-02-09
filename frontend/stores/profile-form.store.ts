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
  location: string; // Sprint 20: Geolocalización
  selectedCategories: string[];
  showTokenUsage: boolean;

  // Estado inicial (para reset)
  initialName: string;
  initialLocation: string; // Sprint 20: Estado inicial de location
  initialCategories: string[];

  // Actions
  setName: (name: string) => void;
  setLocation: (location: string) => void; // Sprint 20: Setter para location
  toggleCategory: (category: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  toggleTokenUsage: () => void;
  setInitialState: (profile: { name: string | null; location?: string | null; preferences?: { categories?: string[] } }) => void;
  reset: () => void;
  getSavePayload: () => {
    name: string | undefined;
    location: string | undefined; // Sprint 20: Incluir location en payload
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
  location: '', // Sprint 20: Estado inicial
  selectedCategories: [],
  showTokenUsage: false,
  initialName: '',
  initialLocation: '', // Sprint 20: Estado inicial
  initialCategories: [],

  // Actualizar nombre
  setName: (name: string) => set({ name }),

  // Actualizar ubicación (Sprint 20)
  setLocation: (location: string) => set({ location }),

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
    const location = profile.location || ''; // Sprint 20: Sincronizar location
    const categories = profile.preferences?.categories || [];

    set({
      name,
      location, // Sprint 20: Establecer location
      selectedCategories: categories,
      initialName: name,
      initialLocation: location, // Sprint 20: Guardar estado inicial
      initialCategories: categories,
    });
  },

  // Reset a valores iniciales
  reset: () => {
    const { initialName, initialLocation, initialCategories } = get();
    set({
      name: initialName,
      location: initialLocation, // Sprint 20: Reset location
      selectedCategories: initialCategories,
      showTokenUsage: false,
    });
  },

  // Preparar payload para guardar en API
  getSavePayload: () => {
    const { name, location, selectedCategories } = get();
    return {
      name: name || undefined, // API espera undefined si está vacío
      location: location || undefined, // Sprint 20: Incluir location en payload
      preferences: {
        categories: selectedCategories,
      },
    };
  },
}));
