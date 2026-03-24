import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfilePage from '@/app/profile/page';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProfileAuth', () => ({
  useProfileAuth: () => ({
    user: {
      uid: 'user-1',
      email: 'test@example.com',
      photoURL: null,
      displayName: 'Test User',
      emailVerified: true,
    },
    authLoading: false,
    getToken: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      picture: null,
      plan: 'FREE',
      location: 'Madrid',
      preferences: { categories: ['Tecnología'] },
      entitlements: { deepAnalysis: false },
      usageStats: {
        articlesAnalyzed: 4,
        searchesPerformed: 2,
        chatMessages: 1,
      },
      counts: {
        favorites: 3,
        searchHistory: 2,
        chats: 1,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    loading: false,
    saving: false,
    save: vi.fn(),
  }),
}));

vi.mock('@/stores/profile-form.store', () => ({
  useProfileFormStore: () => ({
    name: 'Test User',
    location: 'Madrid',
    selectedCategories: ['Tecnología'],
    setName: vi.fn(),
    setLocation: vi.fn(),
    toggleCategory: vi.fn(),
    setInitialState: vi.fn(),
    getSavePayload: () => ({
      name: 'Test User',
      location: 'Madrid',
      preferences: { categories: ['Tecnología'] },
    }),
  }),
}));

vi.mock('@/components/profile', () => ({
  ProfileHeader: () => <div data-testid="profile-header" />,
  UsageStatsCard: () => <div data-testid="usage-stats-card" />,
  AccountLevelCard: ({ onOpenAiObserver }: { onOpenAiObserver?: () => void }) => (
    <button type="button" onClick={onOpenAiObserver}>
      Abrir AI Observer
    </button>
  ),
  CategoryPreferences: () => <div data-testid="category-preferences" />,
}));

vi.mock('@/components/subscription/pricing-modal', () => ({
  PricingModal: () => null,
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navega al panel completo de observabilidad desde el CTA actual', () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Abrir AI Observer'));

    expect(mockPush).toHaveBeenCalledWith('/admin/ai-usage');
  });

  it('ya no renderiza la tarjeta reducida de uso de tokens en perfil', () => {
    render(<ProfilePage />);

    expect(screen.queryByText('Uso de Tokens (Gemini API)')).not.toBeInTheDocument();
  });
});
