/**
 * LocalScopeBadge - Badge que indica el alcance geográfico de noticias locales
 *
 * Sprint 32 - Local News vNext
 * Muestra el scope usado en la búsqueda de noticias locales:
 * - city: Badge compacto con ciudad
 * - province: Badge + texto explicativo (cobertura limitada)
 * - general: Badge + texto explicativo (sin cobertura específica)
 */

import { Badge } from '@/components/ui/badge';
import { MapPin, Info, Globe } from 'lucide-react';

interface LocalScopeBadgeProps {
  localMeta: {
    scopeUsed: 'city' | 'province' | 'region' | 'general';
    resolved: {
      city?: string;
      province?: string;
      region?: string;
    };
  };
}

export function LocalScopeBadge({ localMeta }: LocalScopeBadgeProps) {
  const { scopeUsed, resolved } = localMeta;

  if (scopeUsed === 'city') {
    return (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        {resolved.city}
      </Badge>
    );
  }

  if (scopeUsed === 'province') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Info className="h-3 w-3" />
          {resolved.province}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Mostrando noticias de {resolved.province} (cobertura local limitada)
        </p>
      </div>
    );
  }

  // scopeUsed === 'general' | 'region'
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <Globe className="h-3 w-3" />
        General
      </Badge>
      <p className="text-xs text-muted-foreground">
        Mostrando noticias locales de España (sin cobertura específica)
      </p>
    </div>
  );
}
