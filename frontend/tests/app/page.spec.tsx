/**
 * Tests for Home Page (page.tsx) - Infinite Scroll + Topics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';
import type { NewsArticle } from '@/lib/api';

// =========================================================================
// MOCKS
// =========================================================================

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
  }),
}));

const mockUseAuth = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseNewsInfinite = vi.fn();

vi.mock('@/hooks/useNewsInfinite', () => ({
  useNewsInfinite: (params: any) => mockUseNewsInfinite(params),
}));

const mockUseInvalidateNews = vi.fn();

vi.mock('@/hooks/useNews', () => ({
  useInvalidateNews: () => mockUseInvalidateNews,
}));

const mockUseDashboardStats = vi.fn();

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => mockUseDashboardStats(),
}));

const mockGroupArticlesByDate = vi.fn();

vi.mock('@/lib/date-utils', () => ({
  groupArticlesByDate: (articles: NewsArticle[]) => mockGroupArticlesByDate(articles),
}));

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}));

vi.mock('@/components/news/news-grid', () => ({
  NewsGrid: ({ articles }: { articles: NewsArticle[] }) => (
    <div data-testid="news-grid" data-count={articles.length} />
  ),
}));

vi.mock('@/components/date-separator', () => ({
  DateSeparator: ({ label, articleCount }: { label: string; articleCount: number }) => (
    <div data-testid="date-separator" data-label={label} data-count={articleCount} />
  ),
}));

vi.mock('@/components/layout', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
  DashboardDrawer: () => <div data-testid="dashboard-drawer" />,
}));

vi.mock('@/components/sources-drawer', () => ({
  SourcesDrawer: () => <div data-testid="sources-drawer" />,
}));

vi.mock('@/components/general-chat-drawer', () => ({
  GeneralChatDrawer: () => <div data-testid="general-chat-drawer" />,
}));

vi.mock('@/components/search-bar', () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock('@/components/ui/scroll-to-top', () => ({
  ScrollToTop: () => <div data-testid="scroll-to-top" />,
}));

// =========================================================================
// TEST DATA
// =========================================================================

const createMockArticle = (id: string, overrides?: Partial<NewsArticle>): NewsArticle => ({
  id,
  title: `Mock Article ${id}`,
  description: `Description for article ${id}`,
  content: `Content for article ${id}`,
  source: 'Mock Source',
  url: `https://example.com/article-${id}`,
  urlToImage: `https://example.com/image-${id}.jpg`,
  author: 'Mock Author',
  publishedAt: '2026-02-10T10:00:00.000Z',
  category: 'general',
  language: 'es',
  summary: `Summary for article ${id}`,
  biasScore: 0.5,
  analysis: {
    summary: `Analysis summary for article ${id}`,
    biasScore: 0.5,
    biasRaw: 0,
    biasIndicators: [],
    clickbaitScore: 30,
    reliabilityScore: 0.8,
    sentiment: 'neutral',
    mainTopics: [],
    factCheck: {
      claims: [],
      verdict: 'SupportedByArticle',
      reasoning: 'Mock fact check reasoning',
    },
  },
  analyzedAt: '2026-02-10T10:00:00.000Z',
  isFavorite: false,
  ...overrides,
});

const buildInfiniteData = (articles: NewsArticle[], total?: number) => ({
  pages: [
    {
      data: articles,
      pagination: {
        total: total ?? articles.length,
        limit: 20,
        offset: 0,
        hasMore: false,
      },
    },
  ],
  pageParams: [0],
});

// =========================================================================
// TEST SUITE
// =========================================================================

describe('Home Page - Infinite Scroll', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('topic');

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as any;

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com' },
      loading: false,
    });

    mockUseDashboardStats.mockReturnValue({
      data: {
        totalArticles: 100,
        analyzedCount: 80,
        coverage: 80,
        biasDistribution: { left: 0, neutral: 0, right: 0 },
      },
    });

    mockUseNewsInfinite.mockReturnValue({
      data: buildInfiniteData([createMockArticle('1')]),
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });

    mockGroupArticlesByDate.mockReturnValue([
      {
        label: 'Hoy',
        date: '2026-02-10',
        articles: [createMockArticle('1')],
      },
    ]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('muestra loading cuando auth esta verificando', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    render(<Home />);

    expect(screen.getByText(/Cargando Verity/i)).toBeInTheDocument();
    expect(screen.getByText(/Verificando sesi[oó]n/i)).toBeInTheDocument();
  });

  it('redirige a /login si no hay usuario autenticado', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(<Home />);

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText(/Verity News/i)).not.toBeInTheDocument();
  });

  it('muestra estado de error cuando falla la carga', () => {
    mockUseNewsInfinite.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isError: true,
      error: new Error('Failed to fetch news'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });

    render(<Home />);

    expect(screen.getByText(/Error al cargar las noticias/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch news/i)).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/localhost:3000/i)).toBeInTheDocument();
  });

  it('muestra empty state para topic general', () => {
    mockUseNewsInfinite.mockReturnValue({
      data: buildInfiniteData([], 0),
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });

    render(<Home />);

    expect(screen.getByText(/No hay noticias de/i)).toBeInTheDocument();
  });

  it('muestra empty state para favoritos', () => {
    mockSearchParams.set('topic', 'favorites');

    mockUseNewsInfinite.mockReturnValue({
      data: buildInfiniteData([], 0),
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });

    render(<Home />);

    expect(screen.getByText(/No tienes favoritos todav[ií]a/i)).toBeInTheDocument();
    expect(screen.getByText(/Marca noticias como favoritas/i)).toBeInTheDocument();
  });

  it('renderiza noticias agrupadas y contador', () => {
    const articles = [
      createMockArticle('1', { title: 'Noticia 1' }),
      createMockArticle('2', { title: 'Noticia 2' }),
    ];

    mockUseNewsInfinite.mockReturnValue({
      data: buildInfiniteData(articles, 2),
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });

    mockGroupArticlesByDate.mockReturnValue([
      {
        label: 'Hoy',
        date: '2026-02-10',
        articles,
      },
    ]);

    render(<Home />);

    expect(screen.getByText(/Mostrando 2 de 2/i)).toBeInTheDocument();

    const separators = screen.getAllByTestId('date-separator');
    expect(separators).toHaveLength(1);

    const grids = screen.getAllByTestId('news-grid');
    expect(grids).toHaveLength(1);
    expect(grids[0]).toHaveAttribute('data-count', '2');
  });

  it('usa el topic de la URL en useNewsInfinite', () => {
    mockSearchParams.set('topic', 'economia');

    render(<Home />);

    expect(mockUseNewsInfinite).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'economia',
        limit: 20,
      })
    );
  });
});
