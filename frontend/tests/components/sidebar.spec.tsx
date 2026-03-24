import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';

const mockUseAuth = vi.fn();
const mockUseGlobalRefresh = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useNews', () => ({
  useGlobalRefresh: () => mockUseGlobalRefresh,
}));

vi.mock('@/lib/api', () => ({
  refreshLocalNews: vi.fn(),
}));

vi.mock('@/lib/profile.api', () => ({
  updateUserProfile: vi.fn(),
}));

describe('Sidebar ecosystem launcher', () => {
  const originalMbaUrl = process.env.NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL;

  const renderSidebar = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <Sidebar isMobileOpen onMobileOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com' },
      logout: vi.fn(),
      getToken: vi.fn(),
    });
    mockUseGlobalRefresh.mockResolvedValue({ data: { totalNewArticles: 0 } });
    delete process.env.NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL = originalMbaUrl;
  });

  it('renderiza un launcher externo a Media Bias Atlas con URL configurable', () => {
    process.env.NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL = 'https://mba.demo.test';

    renderSidebar();

    const launcher = screen.getByRole('link', { name: /Media Bias Atlas/i });

    expect(launcher).toHaveAttribute('href', 'https://mba.demo.test');
    expect(launcher).toHaveAttribute('target', '_blank');
    expect(launcher).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByText(/^Medios$/i)).not.toBeInTheDocument();
  });

  it('usa el fallback local explicito cuando no se define la URL de MBA', () => {
    renderSidebar();

    const launcher = screen.getByRole('link', { name: /Media Bias Atlas/i });

    expect(launcher).toHaveAttribute('href', 'http://localhost:3004');
  });
});
