import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanAccessChat } from '@/hooks/useCanAccessChat';

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: (...args: any[]) => mockUseProfile(...args),
}));

describe('useCanAccessChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com' },
      loading: false,
      getToken: vi.fn().mockResolvedValue('token'),
    });

    mockUseProfile.mockReturnValue({
      profile: {
        id: 'user-1',
        email: 'test@example.com',
        name: null,
        picture: null,
        plan: 'FREE',
        entitlements: { deepAnalysis: false },
        location: null,
        preferences: {},
        usageStats: { articlesAnalyzed: 0, searchesPerformed: 0, chatMessages: 0 },
        counts: { favorites: 0, searchHistory: 0, chats: 0 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      loading: false,
      saving: false,
      authToken: 'token',
      save: vi.fn(),
    });
  });

  it('allows chat for premium plan users', () => {
    mockUseProfile.mockReturnValue({
      profile: {
        plan: 'PREMIUM',
        entitlements: { deepAnalysis: false },
      },
      loading: false,
      saving: false,
      authToken: 'token',
      save: vi.fn(),
    });

    const { result } = renderHook(() => useCanAccessChat());

    expect(result.current).toEqual({ canAccess: true, reason: 'PREMIUM' });
  });

  it('allows chat for free users with deep-analysis entitlement', () => {
    mockUseProfile.mockReturnValue({
      profile: {
        plan: 'FREE',
        entitlements: { deepAnalysis: true },
      },
      loading: false,
      saving: false,
      authToken: 'token',
      save: vi.fn(),
    });

    const { result } = renderHook(() => useCanAccessChat());

    expect(result.current).toEqual({ canAccess: true, reason: 'PREMIUM' });
  });

  it('blocks chat for free users without entitlement', () => {
    const { result } = renderHook(() => useCanAccessChat());

    expect(result.current).toEqual({
      canAccess: false,
      reason: 'PREMIUM_REQUIRED',
    });
  });

  it('returns NOT_AUTHENTICATED when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      getToken: vi.fn(),
    });
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      saving: false,
      authToken: '',
      save: vi.fn(),
    });

    const { result } = renderHook(() => useCanAccessChat());

    expect(result.current).toEqual({
      canAccess: false,
      reason: 'NOT_AUTHENTICATED',
    });
  });
});
