'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Settings,
  Rss,
  LogOut,
  User,
  MessageSquare,
  MapPin,
  Globe,
  Flag,
  TrendingUp,
  FlaskConical,
  Film,
  Trophy,
  HeartPulse,
  Heart,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useGlobalRefresh } from '@/hooks/useNews';
import { toast } from 'sonner';

interface SidebarProps {
  onOpenDashboard?: () => void;
  onOpenSources?: () => void;
  onOpenChat?: () => void;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function Sidebar({
  onOpenDashboard,
  onOpenSources,
  onOpenChat,
  isMobileOpen: isMobileOpenProp,
  onMobileOpenChange,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileOpenInternal, setIsMobileOpenInternal] = useState(false);
  const isMobileOpen = typeof isMobileOpenProp === 'boolean' ? isMobileOpenProp : isMobileOpenInternal;
  const setIsMobileOpen = onMobileOpenChange ?? setIsMobileOpenInternal;
  const [isRefreshing, setIsRefreshing] = useState(false); // Global refresh loading state
  const { user, logout } = useAuth();
  const router = useRouter();
  const globalRefresh = useGlobalRefresh();
  const cronSecret = process.env.NEXT_PUBLIC_CRON_SECRET;
  const canGlobalRefresh = !!cronSecret;

  // Handler para actualización global de TODAS las categorías
  const handleGlobalRefresh = async () => {
    if (isRefreshing) return; // Prevenir múltiples clicks

    if (!cronSecret) {
      toast.error('Actualización global deshabilitada', {
        description: 'Configura NEXT_PUBLIC_CRON_SECRET para habilitar esta acción.',
        duration: 5000,
      });
      return;
    }

    setIsRefreshing(true);

    // Toast de inicio
    toast.info('Iniciando actualización global de fuentes...', {
      description: 'Esto puede tardar unos segundos',
      duration: 3000,
    });

    try {
      const result = await globalRefresh();

      // Toast de éxito con estadísticas
      toast.success('¡Todo actualizado!', {
        description: `Noticias frescas en todas las categorías. ${result.data.totalNewArticles} artículos nuevos.`,
        duration: 5000,
      });

      console.log('✅ [GlobalRefresh] Completado:', result.data);
    } catch (error) {
      // Toast de error
      toast.error('Error al actualizar', {
        description: 'No se pudo completar la actualización. Intenta de nuevo.',
        duration: 5000,
      });

      console.error('❌ [GlobalRefresh] Error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sprint 20: Categorías unificadas con geolocalización
  const topicItems = [
    {
      label: 'España',
      icon: Flag,
      href: '/?topic=espana',
    },
    {
      label: 'Internacional',
      icon: Globe,
      href: '/?topic=internacional',
    },
    {
      label: 'Local',
      icon: MapPin,
      href: '/?topic=local',
    },
    {
      label: 'Economía',
      icon: TrendingUp,
      href: '/?topic=economia',
    },
    {
      label: 'Ciencia y Tecnología',
      icon: FlaskConical,
      href: '/?topic=ciencia-tecnologia',
    },
    {
      label: 'Entretenimiento',
      icon: Film,
      href: '/?topic=entretenimiento',
    },
    {
      label: 'Deportes',
      icon: Trophy,
      href: '/?topic=deportes',
    },
    {
      label: 'Salud',
      icon: HeartPulse,
      href: '/?topic=salud',
    },
  ];

  const navItems = [
    {
      label: 'Actualizar Todo',
      icon: RefreshCw,
      onClick: handleGlobalRefresh,
      disabled: !canGlobalRefresh,
    },
    {
      label: 'Favoritos',
      icon: Heart,
      href: '/?topic=favorites', // Navegación a favoritos
    },
    {
      label: 'Chat IA',
      icon: MessageSquare,
      onClick: () => {
        onOpenChat?.();
      },
    },
    {
      label: 'Medios',
      icon: BarChart3,
      onClick: () => {
        onOpenDashboard?.();
      },
    },
    {
      label: 'Fuentes RSS',
      icon: Rss,
      onClick: () => {
        onOpenSources?.();
      },
    },
  ];

  return (
    <>
      {/* Mobile Sidebar Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <img src="/favicon.ico" alt="Logo Verity News" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-bold text-lg">Verity</span>
            </SheetTitle>
          </SheetHeader>

          <nav className="px-3 py-4 space-y-4 overflow-y-auto h-[calc(100vh-80px)]">
            <div className="px-2 py-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Temas
              </h3>
            </div>
            <div className="space-y-1">
              {topicItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                      'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                      'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 my-4" />

            <div className="space-y-1">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isRefreshButton = item.label === 'Actualizar Todo';
                const showSpinner = isRefreshButton && isRefreshing;
                const isDisabled = Boolean((item as { disabled?: boolean }).disabled) || showSpinner;

                if ('href' in item && item.href) {
                  return (
                    <Link
                      key={index}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                        'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                        'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <button
                    key={index}
                    onClick={async () => {
                      await item.onClick?.();
                      setIsMobileOpen(false);
                    }}
                    disabled={isDisabled}
                    className={cn(
                      'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                      'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                      'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900',
                      isDisabled && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', showSpinner && 'animate-spin')} />
                    <span className="text-sm font-medium">
                      {showSpinner ? 'Actualizando...' : item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 my-4" />

            <div className="space-y-2">
              <Link
                href="/settings"
                onClick={() => setIsMobileOpen(false)}
                className="w-full h-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center gap-3 px-3 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm">Ajustes</span>
              </Link>

              {user && (
                <Link
                  href="/profile"
                  onClick={() => setIsMobileOpen(false)}
                  className="w-full h-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center gap-3 px-3 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuario'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <User className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm truncate flex-1">{user.email}</span>
                </Link>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await logout();
                  } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                  } finally {
                    setIsMobileOpen(false);
                  }
                }}
                className="w-full h-11 justify-start text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm ml-2">Salir</span>
              </Button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Collapsible Sidebar - Side Tab Design */}
      <aside
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40 flex-col',
          isOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo & Toggle */}
        <div className="px-4 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {isOpen && (
            <Link href="/" className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <img src="/favicon.ico" alt="Logo Verity News" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-bold text-lg text-zinc-900 dark:text-white truncate">
                Verity
              </span>
            </Link>
          )}
          {!isOpen && (
            <Link href="/" className="flex items-center justify-center w-full">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <img src="/favicon.ico" alt="Logo Verity News" className="w-6 h-6 object-contain" />
              </div>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-9 w-9 shrink-0"
          >
            {isOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-6 space-y-4 overflow-y-auto">
          {/* Sprint 20: Temas/Categorías */}
          {isOpen && (
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Temas
              </h3>
            </div>
          )}
          <div className="space-y-1">
            {topicItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                    'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                    'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                  )}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {isOpen && <span className="text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Separador */}
          {isOpen && <div className="border-t border-zinc-200 dark:border-zinc-800 my-4" />}

          {/* Acciones principales */}
          <div className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isRefreshButton = item.label === 'Actualizar Todo';
              const showSpinner = isRefreshButton && isRefreshing;
              const isDisabled = Boolean((item as { disabled?: boolean }).disabled) || showSpinner;

              // Si el item tiene href, renderizar Link; si tiene onClick, renderizar button
              if ('href' in item && item.href) {
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={cn(
                      'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                      'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                      'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                    )}
                    title={!isOpen ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                );
              }

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  disabled={isDisabled}
                  className={cn(
                    'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                    'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                    'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900',
                    isDisabled && 'opacity-70 cursor-not-allowed'
                  )}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', showSpinner && 'animate-spin')} />
                  {isOpen && (
                    <span className="text-sm font-medium">
                      {showSpinner ? 'Actualizando...' : item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings & User Profile */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-2 py-4 space-y-2">
          {/* Settings Button (Sprint 19.8) */}
          <Link
            href="/settings"
            className="w-full h-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-3 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            title={!isOpen ? 'Ajustes de Visualización' : undefined}
            onClick={() => setIsOpen(false)}
          >
            <Settings className="h-5 w-5" />
            {isOpen && <span className="text-sm">Ajustes</span>}
          </Link>

          {/* User Profile */}
          {user && (
            <Link
              href="/profile"
              className="w-full h-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-3 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              title={!isOpen ? 'Perfil' : undefined}
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
              {isOpen && <span className="text-sm truncate flex-1">{user.email}</span>}
            </Link>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              try {
                await logout();
              } catch (error) {
                console.error('Error al cerrar sesión:', error);
              }
            }}
            className="w-full h-11 justify-center text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
            title={!isOpen ? 'Cerrar sesión' : undefined}
          >
            <LogOut className="h-5 w-5" />
            {isOpen && <span className="text-sm ml-2">Salir</span>}
          </Button>
        </div>
      </aside>

      {/* Spacer */}
      <div className={cn('hidden lg:block transition-all duration-300', isOpen ? 'w-64' : 'w-20')} />
    </>
  );
}
