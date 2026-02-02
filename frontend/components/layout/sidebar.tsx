'use client';

import { useState } from 'react';
import Link from 'next/link';
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

  const navItems = [
    {
      label: 'Últimas noticias',
      href: '/',
      icon: Newspaper,
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

        {/* User Profile & Logout */}
        <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900">
            {/* Avatar */}
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuario'}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-white" />
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {user?.displayName || 'Usuario'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email || 'Sin email'}
              </p>
            </div>

            {/* Logout Button */}
            <button
              onClick={async () => {
                try {
                  await logout();
                  setIsOpen(false);
                } catch (error) {
                  console.error('Error al cerrar sesión:', error);
                }
              }}
              className="shrink-0 p-2 rounded-lg text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-64 shrink-0" />
    </>
  );
}
