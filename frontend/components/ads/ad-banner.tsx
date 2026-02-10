/**
 * Ad Banner Component - Reusable AdSense Banner
 *
 * Componente reutilizable para mostrar banners de publicidad de Google AdSense.
 * Soporta modo mock para desarrollo y modo real para producción.
 *
 * Características:
 * - NO muestra anuncios a usuarios PREMIUM
 * - Modo mock en desarrollo (espacio placeholder)
 * - Modo real en producción (anuncios de AdSense)
 * - Responsive y personalizable
 *
 * @module components/ads/ad-banner
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';

/**
 * Tipos de formato de anuncio soportados por AdSense
 */
export type AdFormat = 'auto' | 'fluid' | 'rectangle';

/**
 * Props del componente AdBanner
 */
export interface AdBannerProps {
  /**
   * ID del slot de AdSense (ej: "1234567890")
   * Obtenido desde el dashboard de Google AdSense
   */
  dataAdSlot: string;

  /**
   * Formato del anuncio
   * - 'auto': Se adapta automáticamente al espacio disponible
   * - 'fluid': Anuncio fluido que se ajusta al contenedor
   * - 'rectangle': Rectángulo estándar (300x250 típicamente)
   */
  format?: AdFormat;

  /**
   * Clases CSS adicionales para el contenedor
   * Útil para controlar dimensiones y posicionamiento
   */
  className?: string;

  /**
   * Etiqueta descriptiva para el modo mock
   * Ej: "Banner Superior", "Sidebar", "Entre Artículos"
   */
  mockLabel?: string;
}

/**
 * Declaración global para el objeto adsbygoogle de Google
 */
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Ad Banner Component
 *
 * Renderiza un banner de publicidad de Google AdSense.
 *
 * @example
 * ```tsx
 * // Banner en el header
 * <AdBanner
 *   dataAdSlot="1234567890"
 *   format="auto"
 *   className="my-4"
 *   mockLabel="Banner Superior"
 * />
 *
 * // Banner en el sidebar
 * <AdBanner
 *   dataAdSlot="9876543210"
 *   format="rectangle"
 *   className="sticky top-4"
 *   mockLabel="Sidebar"
 * />
 * ```
 */
export function AdBanner({
  dataAdSlot,
  format = 'auto',
  className = '',
  mockLabel = 'Publicidad',
}: AdBannerProps) {
  // Variables de entorno
  const adsenseEnabled = process.env.NEXT_PUBLIC_ENABLE_ADSENSE === 'true';
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  // Estado de autenticación y perfil
  const { user, loading: authLoading, getToken } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user, authLoading, getToken);

  // Ref para controlar si ya se ejecutó el push de adsbygoogle
  const adInitialized = useRef(false);

  // =========================================================================
  // CONDICIÓN 1: Usuario PREMIUM → NO mostrar anuncios
  // =========================================================================
  if (!authLoading && !profileLoading && profile?.plan === 'PREMIUM') {
    return null;
  }

  // =========================================================================
  // CONDICIÓN 2: AdSense deshabilitado → Mostrar MOCK
  // =========================================================================
  if (!adsenseEnabled) {
    return (
      <div
        className={`
          flex items-center justify-center
          bg-gray-100 dark:bg-gray-800
          border-2 border-dashed border-gray-300 dark:border-gray-700
          rounded-lg
          min-h-[250px]
          ${className}
        `}
      >
        <div className="text-center p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Espacio Publicitario
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {mockLabel}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            (Modo desarrollo - AdSense deshabilitado)
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CONDICIÓN 3: Client ID no configurado → Advertencia
  // =========================================================================
  if (!clientId || clientId === 'ca-pub-xxxxxxxxxxxxxxxx') {
    return (
      <div
        className={`
          flex items-center justify-center
          bg-yellow-50 dark:bg-yellow-900/20
          border-2 border-dashed border-yellow-300 dark:border-yellow-700
          rounded-lg
          min-h-[250px]
          ${className}
        `}
      >
        <div className="text-center p-6">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
            ⚠️ AdSense no configurado
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-500">
            Configure NEXT_PUBLIC_ADSENSE_CLIENT_ID en .env.local
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODO REAL: Renderizar anuncio de AdSense
  // =========================================================================
  return (
    <AdBannerReal
      dataAdSlot={dataAdSlot}
      format={format}
      className={className}
      clientId={clientId}
      adInitialized={adInitialized}
    />
  );
}

/**
 * Componente interno para renderizar el anuncio real de AdSense
 * Separado para mejorar la legibilidad y el manejo del useEffect
 */
function AdBannerReal({
  dataAdSlot,
  format,
  className,
  clientId,
  adInitialized,
}: {
  dataAdSlot: string;
  format: AdFormat;
  className: string;
  clientId: string;
  adInitialized: React.MutableRefObject<boolean>;
}) {
  // =========================================================================
  // EFFECT: Inicializar anuncio de AdSense
  // =========================================================================
  useEffect(() => {
    // Evitar doble inicialización en modo strict de React
    if (adInitialized.current) {
      return;
    }

    try {
      // Inicializar el array de adsbygoogle si no existe
      window.adsbygoogle = window.adsbygoogle || [];

      // Push del anuncio al array de AdSense
      window.adsbygoogle.push({});

      adInitialized.current = true;

      console.log('✅ AdSense: Banner inicializado', {
        slot: dataAdSlot,
        format,
      });
    } catch (error) {
      console.error('❌ AdSense: Error al inicializar banner:', error);
    }
  }, [dataAdSlot, format, adInitialized]);

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={dataAdSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
