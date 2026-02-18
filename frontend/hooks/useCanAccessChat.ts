/**
 * Hook: useCanAccessChat
 *
 * Chat access follows the same premium rule used by deep analysis:
 * - PREMIUM plan -> allowed
 * - deepAnalysis entitlement (promo) -> allowed
 * - otherwise -> blocked
 */

import { useAuth } from '@/context/AuthContext';
import { isUserPremium } from '@/lib/auth';
import { useEntitlements } from './useEntitlements';
import { useProfile } from './useProfile';

interface ChatAccessResult {
  canAccess: boolean;
  reason: 'PREMIUM' | 'PREMIUM_REQUIRED' | 'NOT_AUTHENTICATED' | 'LOADING';
}

export function useCanAccessChat(): ChatAccessResult {
  const { user, loading: authLoading, getToken } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user, authLoading, getToken);
  const { entitlements, loading: entitlementsLoading } = useEntitlements(user, authLoading, getToken);

  if (authLoading || profileLoading || entitlementsLoading) {
    return {
      canAccess: false,
      reason: 'LOADING',
    };
  }

  if (!user || !profile) {
    return {
      canAccess: false,
      reason: 'NOT_AUTHENTICATED',
    };
  }

  const canAccess = isUserPremium({
    plan: profile.plan,
    entitlements: entitlements ?? profile.entitlements,
  });

  return {
    canAccess,
    reason: canAccess ? 'PREMIUM' : 'PREMIUM_REQUIRED',
  };
}
