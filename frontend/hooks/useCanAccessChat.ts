/**
 * Hook: useCanAccessChat
 * Sprint 30: Premium Chat with 7-day trial period
 *
 * Determina si el usuario actual puede acceder a las funcionalidades de Chat.
 *
 * Reglas de acceso:
 * - PREMIUM: Siempre permitido
 * - FREE + dentro de 7 días desde creación: Permitido (trial)
 * - FREE + después de 7 días: Bloqueado (mostrar upgrade CTA)
 * - No autenticado: Bloqueado (mostrar login CTA)
 */

import { useAuth } from '@/context/AuthContext';
import { useProfile } from './useProfile';

const TRIAL_PERIOD_DAYS = 7;

interface ChatAccessResult {
  canAccess: boolean;
  reason: 'PREMIUM' | 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'NOT_AUTHENTICATED' | 'LOADING';
  daysRemaining?: number; // Solo para TRIAL_ACTIVE
  trialExpired?: boolean; // true si FREE y fuera de trial
}

export function useCanAccessChat(): ChatAccessResult {
  const { user, loading: authLoading, getToken } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user, authLoading, getToken);

  // Loading state
  if (authLoading || profileLoading) {
    return {
      canAccess: false,
      reason: 'LOADING',
    };
  }

  // Not authenticated
  if (!user || !profile) {
    return {
      canAccess: false,
      reason: 'NOT_AUTHENTICATED',
    };
  }

  // PREMIUM users always have access
  if (profile.plan === 'PREMIUM') {
    return {
      canAccess: true,
      reason: 'PREMIUM',
    };
  }

  // FREE users: check trial period
  if (profile.plan === 'FREE') {
    const createdAt = new Date(profile.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = TRIAL_PERIOD_DAYS - daysSinceCreation;

    if (daysSinceCreation <= TRIAL_PERIOD_DAYS) {
      return {
        canAccess: true,
        reason: 'TRIAL_ACTIVE',
        daysRemaining: Math.max(0, daysRemaining),
      };
    } else {
      return {
        canAccess: false,
        reason: 'TRIAL_EXPIRED',
        trialExpired: true,
      };
    }
  }

  // Fallback: deny access
  return {
    canAccess: false,
    reason: 'NOT_AUTHENTICATED',
  };
}
