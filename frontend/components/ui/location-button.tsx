'use client';

/**
 * LocationButton - Geolocalización Automática
 *
 * Sprint 28: Componente que obtiene la ubicación del usuario via
 * navigator.geolocation + Nominatim reverse geocoding.
 *
 * Formato de salida: "Ciudad, Provincia" (ej: "Móstoles, Madrid")
 */

import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  county?: string;
  province?: string;
  country?: string;
}

interface NominatimResponse {
  address: NominatimAddress;
}

export interface LocationButtonProps {
  onLocationFound: (location: string) => void;
  variant?: 'outline' | 'ghost' | 'default';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

/**
 * Parse Nominatim response to extract "Ciudad, Provincia"
 */
function parseLocation(address: NominatimAddress): string {
  // City: try city > town > village > municipality
  const city = address.city || address.town || address.village || address.municipality;

  // Province: try state > province > county
  const province = address.state || address.province || address.county;

  if (city && province) {
    // Avoid "Madrid, Madrid" duplication
    if (city.toLowerCase() === province.toLowerCase()) {
      return city;
    }
    return `${city}, ${province}`;
  }

  if (city) return city;
  if (province) return province;

  return '';
}

export function LocationButton({
  onLocationFound,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  className,
}: LocationButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    // Check browser support
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get coordinates
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // Cache 5 min
        });
      });

      const { latitude, longitude } = position.coords;

      // Step 2: Reverse geocode via Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=es`,
        {
          headers: {
            'User-Agent': 'VerityNews/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener la ubicación desde el mapa');
      }

      const data: NominatimResponse = await response.json();
      const location = parseLocation(data.address);

      if (!location) {
        toast.error('No se pudo determinar tu ciudad');
        return;
      }

      // Step 3: Callback
      onLocationFound(location);
      toast.success(`Ubicación detectada: ${location}`);
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Permiso de ubicación denegado', {
              description: 'Activa la ubicación en los ajustes de tu navegador',
            });
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Ubicación no disponible');
            break;
          case error.TIMEOUT:
            toast.error('Tiempo de espera agotado', {
              description: 'Intenta de nuevo',
            });
            break;
        }
      } else {
        toast.error('Error al detectar tu ubicación');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={className}
      title="Detectar mi ubicación"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1.5">
          {loading ? 'Detectando...' : 'Detectar'}
        </span>
      )}
    </Button>
  );
}
