/**
 * usePreferences Hook
 * Sprint 19.8 - Ajustes de Visualización
 *
 * Gestiona las preferencias de usuario para apariencia y accesibilidad.
 * Persistencia en localStorage.
 */

'use client';

import { useState, useEffect } from 'react';

export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type ViewMode = 'compact' | 'comfortable';
export type MaxContentWidth = 'narrow' | 'normal' | 'wide' | 'full';

export interface Preferences {
  fontSize: FontSize;
  reduceMotion: boolean;
  viewMode: ViewMode;
  maxContentWidth: MaxContentWidth; // Ayuda con dislexia y concentración
}

const STORAGE_KEY = 'verity-news-preferences';

const DEFAULT_PREFERENCES: Preferences = {
  fontSize: 'base',
  reduceMotion: false,
  viewMode: 'comfortable',
  maxContentWidth: 'normal', // 800px por defecto
};

/**
 * Hook para gestionar preferencias de visualización del usuario
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Preferences;
        setPreferences(parsed);
        console.log('[Preferences] Loaded from localStorage:', parsed);
      }
    } catch (error) {
      console.error('[Preferences] Error loading from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      console.log('[Preferences] Saved to localStorage:', preferences);

      // Apply preferences to document
      applyPreferencesToDocument(preferences);
    } catch (error) {
      console.error('[Preferences] Error saving to localStorage:', error);
    }
  }, [preferences, isLoaded]);

  // Apply preferences on mount (after loading)
  useEffect(() => {
    if (isLoaded) {
      applyPreferencesToDocument(preferences);
    }
  }, [isLoaded, preferences]);

  const updateFontSize = (fontSize: FontSize) => {
    setPreferences(prev => ({ ...prev, fontSize }));
  };

  const updateReduceMotion = (reduceMotion: boolean) => {
    setPreferences(prev => ({ ...prev, reduceMotion }));
  };

  const updateViewMode = (viewMode: ViewMode) => {
    setPreferences(prev => ({ ...prev, viewMode }));
  };

  const updateMaxContentWidth = (maxContentWidth: MaxContentWidth) => {
    setPreferences(prev => ({ ...prev, maxContentWidth }));
  };

  const resetToDefaults = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences,
    isLoaded,
    updateFontSize,
    updateReduceMotion,
    updateViewMode,
    updateMaxContentWidth,
    resetToDefaults,
  };
}

/**
 * Apply preferences to the document element
 * This allows global CSS styling based on data attributes
 */
function applyPreferencesToDocument(preferences: Preferences) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Apply font size class
  // Remove all font size classes first
  root.classList.remove('theme-font-sm', 'theme-font-base', 'theme-font-lg', 'theme-font-xl');
  root.classList.add(`theme-font-${preferences.fontSize}`);

  // Apply reduce motion preference
  if (preferences.reduceMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }

  // Apply view mode
  root.setAttribute('data-view-mode', preferences.viewMode);

  // Apply max content width (accessibility for dyslexia and focus)
  root.setAttribute('data-content-width', preferences.maxContentWidth);

  console.log('[Preferences] Applied to document:', {
    fontSizeClass: `theme-font-${preferences.fontSize}`,
    reduceMotion: preferences.reduceMotion,
    viewMode: preferences.viewMode,
    maxContentWidth: preferences.maxContentWidth,
  });
}

/**
 * Get font size label for display
 */
export function getFontSizeLabel(size: FontSize): string {
  const labels: Record<FontSize, string> = {
    sm: 'Pequeña',
    base: 'Normal',
    lg: 'Grande',
    xl: 'Muy Grande',
  };
  return labels[size];
}

/**
 * Get view mode label for display
 */
export function getViewModeLabel(mode: ViewMode): string {
  const labels: Record<ViewMode, string> = {
    compact: 'Compacta',
    comfortable: 'Cómoda',
  };
  return labels[mode];
}

/**
 * Get max content width label for display
 */
export function getMaxContentWidthLabel(width: MaxContentWidth): string {
  const labels: Record<MaxContentWidth, string> = {
    narrow: 'Estrecho (600px)',
    normal: 'Normal (800px)',
    wide: 'Amplio (1000px)',
    full: 'Completo',
  };
  return labels[width];
}
