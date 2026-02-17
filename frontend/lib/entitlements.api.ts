/**
 * Entitlements API Layer
 *
 * Access wrapper for feature entitlements (deep analysis, etc.).
 */

import type { UserEntitlements } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface EntitlementsResponse {
  success: boolean;
  data: {
    entitlements: UserEntitlements;
  };
}

export class EntitlementsAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'EntitlementsAPIError';
  }
}

export async function getEntitlements(token: string): Promise<UserEntitlements> {
  const res = await fetch(`${API_BASE_URL}/api/entitlements`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new EntitlementsAPIError(
      res.status,
      `Failed to fetch entitlements: ${res.statusText}`
    );
  }

  const response: EntitlementsResponse = await res.json();
  return response.data.entitlements;
}

export async function redeemEntitlementCode(
  token: string,
  code: string
): Promise<UserEntitlements> {
  const res = await fetch(`${API_BASE_URL}/api/entitlements/redeem`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    throw new EntitlementsAPIError(
      res.status,
      `Failed to redeem code: ${res.statusText}`
    );
  }

  const response: EntitlementsResponse = await res.json();
  return response.data.entitlements;
}
