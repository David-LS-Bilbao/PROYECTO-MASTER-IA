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
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Handler para refrescar las noticias
  const handleRefreshNews = async () => {
    console.log('🔄 [REFRESH] ========== INICIO REFRESH ==========');
    
    // Detectar categoría actual desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentCategory = urlParams.get('category') || 'general';
    
    console.log('🔄 [REFRESH] URL actual:', window.location.href);
    console.log('🔄 [REFRESH] Categoría detectada:', currentCategory);
    console.log('🔄 [REFRESH] Queries activas ANTES:', 
      queryClient.getQueryCache().getAll()
        .filter(q => q.queryKey[0] === 'news')
        .map(q => ({ key: q.queryKey, state: q.state.status }))
    );
    
    // Solo hacer ingesta RSS si NO es favoritos
    if (currentCategory !== 'favorites') {
      try {
        // 1. Disparar ingesta de noticias SOLO de las fuentes de la categoría actual
        console.log(`📥 [REFRESH] Iniciando ingesta RSS para categoría: ${currentCategory}...`);
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        
        // Preparar body de la request
        const requestBody: any = {
          pageSize: 20, // Suficientes para llenar dashboard
        };
        
        // Solo agregar category si NO es 'general'
        if (currentCategory !== 'general') {
          requestBody.category = currentCategory;
          console.log(`📂 [REFRESH] Filtrando por categoría: ${currentCategory}`);
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
      console.log('⭐ [REFRESH] Categoría FAVORITOS: solo refrescando cache (sin ingesta RSS)');
    }
    
    // 2. Invalidar Y refetch SOLO de la categoría actual
    console.log(`🗑️ [REFRESH] Invalidando queries de categoría: ${currentCategory}`);
    await queryClient.invalidateQueries({ 
      queryKey: ['news', currentCategory],
      exact: false,
      refetchType: 'active',
    });
    
    console.log('🔄 [REFRESH] Queries activas DESPUÉS:', 
      queryClient.getQueryCache().getAll()
        .filter(q => q.queryKey[0] === 'news')
        .map(q => ({ key: q.queryKey, state: q.state.status }))
    );
    
    console.log('✅ [REFRESH] ========== FIN REFRESH ==========');
  };

  const navItems = [
    {
      label: 'Noticias',
      icon: Newspaper,
      onClick: handleRefreshNews,
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
        <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.onClick}
                className={cn(
                  'w-full h-11 rounded-lg transition-colors flex items-center justify-center gap-3',
                  'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                  'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
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
