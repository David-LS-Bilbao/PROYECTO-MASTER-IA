import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewsDetailPage from '@/app/news/[id]/page';

const mockPush = vi.fn();
const mockAnalyzeArticleWithMode = vi.fn();
const mockUseArticle = vi.fn();
const mockUseEntitlements = vi.fn();
const mockUseProfile = vi.fn();
const mockGetToken = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'test@example.com' },
    loading: false,
    getToken: mockGetToken,
  }),
}));

vi.mock('@/hooks/useArticle', () => ({
  useArticle: () => mockUseArticle(),
}));

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => mockUseEntitlements(),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => mockUseProfile(),
}));

vi.mock('@/components/deep-analysis-panel', () => ({
  DeepAnalysisPanel: () => null,
}));

vi.mock('@/components/deep-analysis-redeem-sheet', () => ({
  DeepAnalysisRedeemSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="promo-modal">promo-modal</div> : null,
}));

vi.mock('@/components/news-chat-drawer', () => ({
  NewsChatDrawer: () => null,
}));

vi.mock('@/components/general-chat-drawer', () => ({
  GeneralChatDrawer: () => null,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    analyzeArticleWithMode: (...args: any[]) => mockAnalyzeArticleWithMode(...args),
  };
});

const mockArticle = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  title: 'Articulo test',
  description: 'Descripcion test',
  content: 'Contenido suficientemente largo para render de analisis.',
  url: 'https://example.com/test',
  urlToImage: null,
  source: 'Fuente Test',
  author: 'Autor Test',
  publishedAt: '2026-02-17T10:00:00.000Z',
  category: 'general',
  language: 'es',
  summary: 'Resumen previo',
  biasScore: 0.2,
  analysis: {
    summary: 'Resumen IA',
    biasScore: 0.2,
    biasRaw: 0,
    biasIndicators: [],
    clickbaitScore: 10,
    reliabilityScore: 90,
    sentiment: 'neutral',
    mainTopics: [],
    factCheck: { claims: [], verdict: 'SupportedByArticle', reasoning: '' },
  },
  analyzedAt: '2026-02-17T10:00:00.000Z',
  isFavorite: true,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NewsDetailPage />
    </QueryClientProvider>
  );
}

describe('NewsDetailPage premium gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetToken.mockResolvedValue('jwt-token');

    mockUseArticle.mockReturnValue({
      data: mockArticle,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseEntitlements.mockReturnValue({
      entitlements: { deepAnalysis: false },
      loading: false,
      redeeming: false,
      redeem: vi.fn(),
      refetch: vi.fn(),
    });

    mockUseProfile.mockReturnValue({
      profile: { plan: 'FREE' },
      loading: false,
      saving: false,
      authToken: '',
      save: vi.fn(),
    });

    mockAnalyzeArticleWithMode.mockResolvedValue({
      data: {
        scrapedContentLength: 1200,
      },
    });
  });

  it('premium user can run deep analysis without opening promo modal', async () => {
    const user = userEvent.setup();
    mockUseProfile.mockReturnValue({
      profile: { plan: 'PREMIUM' },
      loading: false,
      saving: false,
      authToken: '',
      save: vi.fn(),
    });

    renderPage();

    const deepButton = screen.getByRole('button', { name: /analisis profundo/i });
    await user.click(deepButton);

    await waitFor(() => {
      expect(mockAnalyzeArticleWithMode).toHaveBeenCalledWith(
        mockArticle.id,
        'jwt-token',
        'standard',
        'deep'
      );
    });
    expect(screen.queryByTestId('promo-modal')).not.toBeInTheDocument();
  });

  it('free user shows premium-required message on deep click and does not open promo modal', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(screen.queryByText(/^Solo para usuarios Premium$/, { selector: 'p' })).not.toBeInTheDocument();

    const deepButton = screen.getByRole('button', { name: /solo para usuarios premium/i });
    await user.click(deepButton);

    expect(mockAnalyzeArticleWithMode).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/^Solo para usuarios Premium$/, { selector: 'p' })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('promo-modal')).not.toBeInTheDocument();
  });
});

