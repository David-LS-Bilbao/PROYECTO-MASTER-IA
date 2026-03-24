import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { EntitlementsAPIError } from '@/lib/entitlements.api';

const mockGetToken = vi.fn();
const mockGetEntitlements = vi.fn();
const mockRedeemEntitlementCode = vi.fn();

vi.mock('@/lib/entitlements.api', () => ({
  EntitlementsAPIError: class EntitlementsAPIError extends Error {
    constructor(
      public statusCode: number,
      message: string
    ) {
      super(message);
      this.name = 'EntitlementsAPIError';
    }
  },
  getEntitlements: (...args: unknown[]) => mockGetEntitlements(...args),
  redeemEntitlementCode: (...args: unknown[]) => mockRedeemEntitlementCode(...args),
}));

const mockUser = { uid: 'user-1', email: 'user@example.com' } as const;

describe('useEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('valid-token');
  });

  it('returns default entitlements when user is not authenticated', async () => {
    const { result } = renderHook(() =>
      useEntitlements(null, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entitlements.deepAnalysis).toBe(false);
    expect(mockGetEntitlements).not.toHaveBeenCalled();
  });

  it('loads entitlements from API for authenticated user', async () => {
    mockGetEntitlements.mockResolvedValueOnce({ deepAnalysis: true });

    const { result } = renderHook(() =>
      useEntitlements(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetEntitlements).toHaveBeenCalledWith('valid-token');
    expect(result.current.entitlements.deepAnalysis).toBe(true);
  });

  it('redeem updates deepAnalysis entitlement', async () => {
    mockGetEntitlements.mockResolvedValueOnce({ deepAnalysis: false });
    mockRedeemEntitlementCode.mockResolvedValueOnce({ deepAnalysis: true });

    const { result } = renderHook(() =>
      useEntitlements(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entitlements.deepAnalysis).toBe(false);

    await act(async () => {
      const activated = await result.current.redeem('VERITY_DEEP');
      expect(activated).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.entitlements.deepAnalysis).toBe(true);
    });

    expect(mockRedeemEntitlementCode).toHaveBeenCalledWith('valid-token', 'VERITY_DEEP');
  });

  it('reintenta con token refrescado cuando entitlements devuelve 401', async () => {
    mockGetToken
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    mockGetEntitlements
      .mockRejectedValueOnce(new EntitlementsAPIError(401, 'Unauthorized'))
      .mockResolvedValueOnce({ deepAnalysis: true });

    const { result } = renderHook(() =>
      useEntitlements(mockUser, false, mockGetToken)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetToken).toHaveBeenNthCalledWith(1, false);
    expect(mockGetToken).toHaveBeenNthCalledWith(2, true);
    expect(mockGetEntitlements).toHaveBeenNthCalledWith(1, 'stale-token');
    expect(mockGetEntitlements).toHaveBeenNthCalledWith(2, 'fresh-token');
    expect(result.current.entitlements.deepAnalysis).toBe(true);
  });
});
