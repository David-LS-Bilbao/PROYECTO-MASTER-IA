/**
 * useEntitlements
 *
 * Manages feature entitlements and promo-code redemption flow.
 */

import { useCallback, useEffect, useState } from 'react';
import type { UserEntitlements } from '@/lib/api';
import { getEntitlements, redeemEntitlementCode } from '@/lib/entitlements.api';
import { toast } from 'sonner';

interface AuthUser {
  uid: string;
  email?: string | null;
}

const DEFAULT_ENTITLEMENTS: UserEntitlements = {
  deepAnalysis: false,
};

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
      const token = await getToken();
      if (!token) {
        setEntitlements(DEFAULT_ENTITLEMENTS);
        return;
      }

      const data = await getEntitlements(token);
      setEntitlements(data);
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
      const token = await getToken(true);
      if (!token) {
        toast.error('Debes iniciar sesion para activar esta funcion');
        return false;
      }

      const updatedEntitlements = await redeemEntitlementCode(token, normalizedCode);
      setEntitlements(updatedEntitlements);
      toast.success('Analisis profundo activado');
      return true;
    } catch (error) {
      console.error('Error redeeming entitlement code:', error);
      toast.error('Codigo no valido');
      return false;
    } finally {
      setRedeeming(false);
    }
  };

  return {
    entitlements,
    loading,
    redeeming,
    redeem,
    refetch,
  };
}
