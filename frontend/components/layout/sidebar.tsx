'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Newspaper,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  onOpenDashboard?: () => void;
  onOpenSources?: () => void;
  onOpenChat?: () => void;
}

export function Sidebar({ onOpenDashboard, onOpenSources, onOpenChat }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // Sprint 23: Loading state
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Handler para refrescar las noticias
  const handleRefreshNews = async () => {
    if (isRefreshing) return; // Prevenir múltiples clicks

    setIsRefreshing(true);
    console.log('🔄 [REFRESH] ========== INICIO REFRESH ==========');

    // Sprint 23: Detectar TOPIC actual desde la URL (no category)
    const urlParams = new URLSearchParams(window.location.search);
    const currentTopic = urlParams.get('topic') || 'general';

    console.log('🔄 [REFRESH] URL actual:', window.location.href);
    console.log('🔄 [REFRESH] Topic detectado:', currentTopic);
    console.log('🔄 [REFRESH] Queries activas ANTES:',
      queryClient.getQueryCache().getAll()
        .filter(q => q.queryKey[0] === 'news')
        .map(q => ({ key: q.queryKey, state: q.state.status }))
    );

    // Solo hacer ingesta RSS si NO es favoritos
    if (currentTopic !== 'favorites') {
      try {
        // 1. Disparar ingesta de noticias con topicSlug (Sprint 23)
        console.log(`📥 [REFRESH] Iniciando ingesta RSS para topic: ${currentTopic}...`);
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

        // Sprint 23: Preparar body con topicSlug
        const requestBody: any = {
          pageSize: 30, // Suficientes para llenar dashboard
        };

        // Sprint 23: Enviar topicSlug para asignar correctamente las noticias
        if (currentTopic !== 'general') {
          requestBody.topicSlug = currentTopic;
          requestBody.category = currentTopic; // Mantener category para filtrado de API externa
          console.log(`📌 [REFRESH] Asignando topicSlug: ${currentTopic}`);
        } else {
          console.log(`🌐 [REFRESH] Ingesta general (todas las categorías)`);
        }

        const response = await fetch(`${API_BASE_URL}/api/ingest/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          console.warn('⚠️ [REFRESH] Error al actualizar noticias:', response.status);
        } else {
          const data = await response.json();
          console.log('✅ [REFRESH] Ingesta completada:', data.message);
          console.log('📊 [REFRESH] Artículos nuevos:', data.data?.newArticles || 0);
        }
      } catch (error) {
        console.error('❌ [REFRESH] Error al ingestar:', error);
      }
    } else {
      console.log('⭐ [REFRESH] Topic FAVORITOS: solo refrescando cache (sin ingesta RSS)');
    }

    // 2. Invalidar Y refetch SOLO del topic actual
    console.log(`🗑️ [REFRESH] Invalidando queries de topic: ${currentTopic}`);

    // FIX: Invalidar AMBOS tipos de queries (useNews y useNewsInfinite)
    // - ['news-infinite', topic, limit] → useNewsInfinite (página principal)
    // - ['news', topic, limit, offset] → useNews (legacy/otros componentes)
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const [base, cat] = query.queryKey;
        const isNewsQuery = base === 'news' || base === 'news-infinite';
        const matchesTopic = cat === currentTopic;

        console.log(`🔍 [REFRESH] Evaluating query: ${JSON.stringify(query.queryKey)} → ${isNewsQuery && matchesTopic ? 'INVALIDATE' : 'SKIP'}`);

        return isNewsQuery && matchesTopic;
      },
      refetchType: 'active',
    });

    console.log('🔄 [REFRESH] Queries activas DESPUÉS:',
      queryClient.getQueryCache().getAll()
        .filter(q => q.queryKey[0] === 'news')
        .map(q => ({ key: q.queryKey, state: q.state.status }))
    );

    console.log('✅ [REFRESH] ========== FIN REFRESH ==========');
    setIsRefreshing(false);
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
      label: 'Noticias',
      icon: Newspaper,
      onClick: handleRefreshNews,
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
      {/* Collapsible Sidebar - Side Tab Design */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40 flex flex-col',
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
              const isNewsButton = item.label === 'Noticias';
              const showSpinner = isNewsButton && isRefreshing;

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
                  disabled={showSpinner}
                  className={cn(
                    'w-full h-10 rounded-lg transition-colors flex items-center gap-3 px-3',
                    'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                    'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900',
                    showSpinner && 'opacity-50 cursor-not-allowed'
                  )}
                  title={!isOpen ? item.label : undefined}
                >
                  {showSpinner ? (
                    <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
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
      <div className={cn('transition-all duration-300', isOpen ? 'w-64' : 'w-20')} />
    </>
  );
}
