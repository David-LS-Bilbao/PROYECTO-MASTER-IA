'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Menu,
  X,
  BarChart3,
  Newspaper,
  Heart,
  Settings,
  Rss,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  onOpenDashboard?: () => void;
  onOpenSources?: () => void;
}

export function Sidebar({ onOpenDashboard, onOpenSources }: SidebarProps) {
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
    
    // Cerrar el sidebar en mobile
    setIsOpen(false);
  };

  const navItems = [
    {
      label: 'Últimas noticias',
      icon: Newspaper,
      onClick: handleRefreshNews,
    },
    {
      label: 'Favoritos',
      href: '/?category=favorites',
      icon: Heart,
    },
    {
      label: 'Inteligencia de Medios',
      icon: BarChart3,
      onClick: () => {
        onOpenDashboard?.();
        setIsOpen(false);
      },
    },
    {
      label: 'Gestionar Fuentes RSS',
      icon: Rss,
      onClick: () => {
        onOpenSources?.();
        setIsOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="fixed top-4 left-4 z-40 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 w-9"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar Backdrop (Mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 flex flex-col transition-transform duration-300 z-40',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="px-6 py-8 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-zinc-900 dark:text-white">
              Verity
            </span>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <SearchBar
            placeholder="Buscar con IA..."
            className="w-full"
          />
        </div>

        {/* Navigation */}
        <nav className="px-3 py-6 space-y-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isClickable = 'onClick' in item;

            if (isClickable) {
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={index}
                href={item.href!}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Settings Button */}
        <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm">Ajustes de IA</span>
          </Button>
        </div>

        {/* User Profile & Logout - Solo mostrar si hay usuario autenticado */}
        {user && (
          <div className="mt-auto px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {/* Avatar o icono de usuario - Clickeable para ir al perfil */}
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer overflow-hidden"
                title="Ver perfil"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      console.error('Error cargando imagen de perfil en sidebar:', user.photoURL);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="h-5 w-5 text-white" />
                )}
                {user.photoURL && (
                  <User className="h-5 w-5 text-white absolute" style={{ display: 'none' }} />
                )}
              </Link>

              {/* Email del usuario truncado - También clickeable */}
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <p className="text-sm text-zinc-900 dark:text-white truncate">
                  {user.email}
                </p>
              </Link>

              {/* Botón de Logout */}
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await logout();
                    setIsOpen(false);
                  } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                  }
                }}
                title="Cerrar sesión"
                className="shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-64 shrink-0" />
    </>
  );
}
