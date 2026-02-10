/**
 * Settings Page - Ajustes de Visualización
 * Sprint 19.8 - Tarea: Página de Ajustes
 *
 * Permite al usuario personalizar:
 * - Tema (Claro/Oscuro/Sistema)
 * - Tamaño de fuente
 * - Densidad de información
 * - Reducir animaciones
 * - Gestión de caché
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  usePreferences,
  getFontSizeLabel,
  getViewModeLabel,
  getMaxContentWidthLabel,
  type FontSize,
  type ViewMode,
  type MaxContentWidth,
} from '@/hooks/usePreferences';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccessibleToggle } from '@/components/ui/accessible-toggle';
import { toast } from 'sonner';
import {
  Sun,
  Moon,
  Monitor,
  Type,
  LayoutGrid,
  List,
  Sparkles,
  Trash2,
  RotateCcw,
  ChevronLeft,
  Check,
  Eye,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const {
    preferences,
    isLoaded,
    updateFontSize,
    updateReduceMotion,
    updateViewMode,
    updateMaxContentWidth,
    resetToDefaults,
  } = usePreferences();

  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('🔒 Usuario no autenticado. Redirigiendo a /login...');
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Loading state
  if (authLoading || !mounted || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-zinc-900 dark:text-white">Cargando ajustes...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Font size options
  const fontSizes: FontSize[] = ['sm', 'base', 'lg', 'xl'];

  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  // View mode options
  const viewModeOptions: { value: ViewMode; label: string; icon: LucideIcon; description: string }[] = [
    {
      value: 'comfortable',
      label: 'Cómoda',
      icon: LayoutGrid,
      description: 'Tarjetas grandes con imágenes (Predeterminado)',
    },
    {
      value: 'compact',
      label: 'Compacta',
      icon: List,
      description: 'Listado denso, ideal para lectura rápida',
    },
  ];

  // Handle clear cache
  const handleClearCache = () => {
    try {
      // Clear React Query cache
      queryClient.clear();

      // Clear localStorage news cache (if any)
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('news-') || key.startsWith('article-')) {
          localStorage.removeItem(key);
        }
      });

      toast.success('Caché limpiada correctamente', {
        description: 'Los datos se recargarán desde el servidor',
      });

      console.log('[Settings] Cache cleared successfully');
    } catch (error) {
      console.error('[Settings] Error clearing cache:', error);
      toast.error('Error al limpiar la caché', {
        description: 'Por favor, intenta de nuevo',
      });
    }
  };

  // Handle reset to defaults
  const handleResetDefaults = () => {
    resetToDefaults();
    setTheme('system');
    toast.success('Ajustes restaurados', {
      description: 'Se aplicaron los valores predeterminados',
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Ajustes de Visualización
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Personaliza la apariencia y accesibilidad de Verity News
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* SECCIÓN A: APARIENCIA */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Apariencia
                </h2>
                <p className="text-sm text-muted-foreground">
                  Personaliza el tema y la densidad visual
                </p>
              </div>
            </div>

            {/* Selector de Tema */}
            <div className="mb-6">
              <label className="text-sm font-medium text-zinc-900 dark:text-white mb-3 block">
                Tema
              </label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${
                        theme === value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }
                    `}
                  >
                    <Icon
                      className={`h-6 w-6 mx-auto mb-2 ${
                        theme === value
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    />
                    <div
                      className={`text-sm font-medium ${
                        theme === value
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-zinc-900 dark:text-white'
                      }`}
                    >
                      {label}
                    </div>
                    {theme === value && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Densidad de Información */}
            <div>
              <label className="text-sm font-medium text-zinc-900 dark:text-white mb-3 block">
                Densidad de Información
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {viewModeOptions.map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    onClick={() => updateViewMode(value)}
                    className={`
                      relative p-4 rounded-lg border-2 text-left transition-all
                      ${
                        preferences.viewMode === value
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`h-5 w-5 mt-0.5 shrink-0 ${
                          preferences.viewMode === value
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium mb-1 ${
                            preferences.viewMode === value
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {label}
                        </div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                      {preferences.viewMode === value && (
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {preferences.viewMode === 'compact' && (
                <Badge variant="secondary" className="mt-3">
                  🚧 Vista compacta próximamente
                </Badge>
              )}
            </div>
          </Card>

          {/* SECCIÓN B: LECTURA Y ACCESIBILIDAD */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Type className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Lectura y Accesibilidad
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ajusta el tamaño de texto y las animaciones
                </p>
              </div>
            </div>

            {/* Tamaño de Fuente */}
            <div className="mb-6">
              <label className="text-sm font-medium text-zinc-900 dark:text-white mb-3 block">
                Tamaño de Fuente Base
              </label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {fontSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => updateFontSize(size)}
                    className={`
                      relative py-3 px-4 rounded-lg border-2 transition-all
                      ${
                        preferences.fontSize === size
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }
                    `}
                  >
                    <div
                      className={`font-medium ${
                        preferences.fontSize === size
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-zinc-900 dark:text-white'
                      }`}
                      style={{
                        fontSize:
                          size === 'sm'
                            ? '0.875rem'
                            : size === 'base'
                            ? '1rem'
                            : size === 'lg'
                            ? '1.125rem'
                            : '1.25rem',
                      }}
                    >
                      A
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {getFontSizeLabel(size)}
                    </div>
                    {preferences.fontSize === size && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Vista Previa */}
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Vista Previa:
                </div>
                <p className="text-zinc-900 dark:text-white">
                  Este es un ejemplo de cómo se verá el texto con el tamaño seleccionado.
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
            </div>

            {/* Ancho de Lectura (Ayuda con Dislexia) */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Maximize2 className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                <label className="text-sm font-medium text-zinc-900 dark:text-white">
                  Ancho de Lectura
                </label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Limita el ancho de las columnas de texto. Útil para dislexia y mejor concentración.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['narrow', 'normal', 'wide', 'full'] as MaxContentWidth[]).map(width => (
                  <button
                    key={width}
                    onClick={() => updateMaxContentWidth(width)}
                    className={`
                      relative py-2 px-3 rounded-lg border-2 text-left transition-all
                      ${
                        preferences.maxContentWidth === width
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }
                    `}
                    aria-pressed={preferences.maxContentWidth === width}
                  >
                    <div
                      className={`text-xs font-medium ${
                        preferences.maxContentWidth === width
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-zinc-900 dark:text-white'
                      }`}
                    >
                      {getMaxContentWidthLabel(width)}
                    </div>
                    {preferences.maxContentWidth === width && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Reducir Movimiento (con AccessibleToggle) */}
            <div>
              <AccessibleToggle
                pressed={preferences.reduceMotion}
                onPressedChange={updateReduceMotion}
                ariaLabel="Reducir animaciones"
                label="Reducir Animaciones"
                description="Desactiva transiciones y animaciones superfluas (WCAG 2.3.3)"
                icon={<Eye className="h-4 w-4" aria-hidden="true" />}
                size="md"
              />
            </div>
          </Card>

          {/* SECCIÓN C: SISTEMA */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Sistema</h2>
                <p className="text-sm text-muted-foreground">
                  Gestiona el almacenamiento y los datos en caché
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Borrar Caché */}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleClearCache}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Borrar Caché de Noticias
              </Button>

              {/* Restaurar Valores Predeterminados */}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleResetDefaults}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar Valores Predeterminados
              </Button>
            </div>
          </Card>

          {/* Info Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Los ajustes se guardan automáticamente y se aplicarán en toda la aplicación.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
