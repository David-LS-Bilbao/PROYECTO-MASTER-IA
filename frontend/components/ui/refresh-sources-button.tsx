/**
 * Refresh Sources Button (Sprint 35)
 * Manual trigger for news ingestion across all categories
 */

'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RefreshSourcesButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function RefreshSourcesButton({
  variant = 'outline',
  size = 'default',
  className,
}: RefreshSourcesButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);

  // Check if cooldown period (5 minutes) has passed
  const canRefresh = () => {
    if (!lastRefreshTime) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastRefreshTime >= fiveMinutes;
  };

  const handleRefresh = async () => {
    if (!canRefresh()) {
      const remainingTime = Math.ceil(
        (5 * 60 * 1000 - (Date.now() - lastRefreshTime!)) / 1000 / 60
      );
      toast.error(`Espera ${remainingTime} minuto(s) antes de recargar de nuevo`);
      return;
    }

    setIsRefreshing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ingest/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          throw new Error(errorData.error || 'Por favor, espera antes de recargar de nuevo');
        }

        throw new Error(errorData.error || 'Error al recargar fuentes');
      }

      const data = await response.json();

      setLastRefreshTime(Date.now());

      toast.success('¡Fuentes actualizadas!', {
        description: `${data.data?.totalNewArticles || 0} nuevos artículos agregados`,
      });

      // Reload page after 2 seconds to show new articles
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('[RefreshSourcesButton] Error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error al recargar fuentes'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDisabled = isRefreshing || !canRefresh();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleRefresh}
      disabled={isDisabled}
      title="Recargar todas las fuentes de noticias"
    >
      <RefreshCw
        className={isRefreshing ? 'animate-spin' : ''}
        size={size === 'icon' ? 18 : 16}
      />
      {size !== 'icon' && <span>Actualizar fuentes</span>}
    </Button>
  );
}
