/**
 * AdSense Script Loader - Global Script Injection
 *
 * Carga el script de Google AdSense de forma condicional:
 * - NO carga si AdSense está deshabilitado en variables de entorno
 * - NO carga si el usuario tiene plan PREMIUM
 * - Solo carga para usuarios FREE o no autenticados
 *
 * Este componente debe incluirse una sola vez en el layout principal.
 *
 * @module components/ads/adsense-script
 */

'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';

/**
 * AdSense Script Loader Component
 *
 * Características:
 * - Carga el script de AdSense solo cuando es necesario
 * - Respeta el flag NEXT_PUBLIC_ENABLE_ADSENSE
 * - No carga para usuarios PREMIUM
 * - Usa next/script con strategy="afterInteractive" para optimizar el rendimiento
 *
 * @returns Script de AdSense o null si no debe cargarse
 */
export function AdSenseScript() {
  // Variables de entorno
  const adsenseEnabled = process.env.NEXT_PUBLIC_ENABLE_ADSENSE === 'true';
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  // Estado de autenticación
  const { user, loading: authLoading, getToken } = useAuth();

  // Estado del perfil (solo se carga si hay usuario autenticado)
  const { profile, loading: profileLoading } = useProfile(user, authLoading, getToken);

  // Estado interno para determinar si debe mostrar el script
  const [shouldLoadScript, setShouldLoadScript] = useState(false);

  useEffect(() => {
    // Condición 1: AdSense debe estar habilitado
    if (!adsenseEnabled) {
      console.log('📢 AdSense: Deshabilitado en variables de entorno');
      setShouldLoadScript(false);
      return;
    }

    // Condición 2: Debe haber un Client ID configurado
    if (!clientId || clientId === 'ca-pub-xxxxxxxxxxxxxxxx') {
      console.warn('⚠️ AdSense: Client ID no configurado correctamente');
      setShouldLoadScript(false);
      return;
    }

    // Condición 3: Esperar a que termine la carga de autenticación
    if (authLoading) {
      console.log('📢 AdSense: Esperando autenticación...');
      return;
    }

    // Caso 1: Usuario NO autenticado → Mostrar anuncios
    if (!user) {
      console.log('📢 AdSense: Usuario no autenticado → Mostrar anuncios');
      setShouldLoadScript(true);
      return;
    }

    // Caso 2: Usuario autenticado → Verificar plan
    if (profileLoading) {
      console.log('📢 AdSense: Cargando perfil del usuario...');
      return;
    }

    if (profile) {
      if (profile.plan === 'PREMIUM') {
        console.log('📢 AdSense: Usuario PREMIUM → NO mostrar anuncios');
        setShouldLoadScript(false);
      } else {
        console.log('📢 AdSense: Usuario FREE → Mostrar anuncios');
        setShouldLoadScript(true);
      }
    } else {
      // Si no hay perfil disponible, por defecto NO cargar (seguro)
      console.log('📢 AdSense: Perfil no disponible → NO mostrar anuncios');
      setShouldLoadScript(false);
    }
  }, [adsenseEnabled, clientId, authLoading, user, profileLoading, profile]);

  // No renderizar nada si no se debe cargar el script
  if (!shouldLoadScript) {
    return null;
  }

  const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;

  console.log('📢 AdSense: Cargando script:', scriptSrc);

  return (
    <Script
      id="google-adsense"
      src={scriptSrc}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        console.log('✅ AdSense: Script cargado correctamente');
      }}
      onError={(e) => {
        console.error('❌ AdSense: Error al cargar script:', e);
      }}
    />
  );
}
