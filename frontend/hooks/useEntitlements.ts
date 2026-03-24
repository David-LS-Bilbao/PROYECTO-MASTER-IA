/**
 * useEntitlements
 *
 * Manages feature entitlements and promo-code redemption flow.
 */

import { useCallback, useEffect, useState } from 'react';
import type { UserEntitlements } from '@/lib/api';
import {
  EntitlementsAPIError,
  getEntitlements,
  redeemEntitlementCode,
} from '@/lib/entitlements.api';
import { toast } from 'sonner';

interface AuthUser {
  uid: string;
  email?: string | null;
}

const DEFAULT_ENTITLEMENTS: UserEntitlements = {
  deepAnalysis: false,
};

const MAX_RETRIES = 2;

export function useEntitlements(
  user: AuthUser | null,
  authLoading: boolean,
  getToken: (forceRefresh?: boolean) => Promise<string | null>,
) {
  const [entitlements, setEntitlements] = useState<UserEntitlements>(DEFAULT_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const refetch = useCallback(async () => {
    if (!user) {
      setEntitlements(DEFAULT_ENTITLEMENTS);
      setLoading(false);
      return;
    }

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const token = await getToken(attempt > 0);
        if (!token) {
          setEntitlements(DEFAULT_ENTITLEMENTS);
          return;
        }

        try {
          const data = await getEntitlements(token);
          setEntitlements(data);
          return;
        } catch (error) {
          const shouldRetry =
            error instanceof EntitlementsAPIError &&
            error.statusCode === 401 &&
            attempt < MAX_RETRIES - 1;

          if (!shouldRetry) {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching entitlements:', error);
      setEntitlements(DEFAULT_ENTITLEMENTS);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    setLoading(true);
    void refetch();
  }, [authLoading, refetch]);

  const redeem = async (code: string): Promise<boolean> => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode || redeeming) {
      return false;
    }

    setRedeeming(true);
    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const token = await getToken(attempt > 0);
        if (!token) {
          toast.error('Debes iniciar sesion para activar esta funcion');
          return false;
        }

        try {
          const updatedEntitlements = await redeemEntitlementCode(token, normalizedCode);
          setEntitlements(updatedEntitlements);
          toast.success('Analisis profundo activado');
          return true;
        } catch (error) {
          const shouldRetry =
            error instanceof EntitlementsAPIError &&
            error.statusCode === 401 &&
            attempt < MAX_RETRIES - 1;

          if (!shouldRetry) {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error redeeming entitlement code:', error);
      toast.error('Codigo no valido');
      return false;
    } finally {
      setRedeeming(false);
    }

    return false;
  };

  return {
    entitlements,
    loading,
    redeeming,
    redeem,
    refetch,
  };
}
