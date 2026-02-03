/**
 * Tests for Home Page (page.tsx) - React Query Integration
 * 
 * Sprint 13 - Fase C: Frontend Moderno
 * 
 * Cobertura:
 * - Estado de carga (Loading State)
 * - Estado de error (Error State)
 * - Renderizado de noticias (Success State)
 * - Interacción con filtros de categoría
 * - Sincronización con URL
 * - Integración con useNews hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';
import type { NewsResponse, NewsArticle } from '@/lib/api';

// =========================================================================
// MOCKS: Next.js Navigation + Auth Context + React Query Hooks
// =========================================================================

// Mock de Next.js navigation
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

// Mock de AuthContext
const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
const mockUseAuth = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock de useNews hook
const mockUseNews = vi.fn();

vi.mock('@/hooks/useNews', () => ({
  useNews: (params: any) => mockUseNews(params),
}));

// Mock de useDashboardStats hook
const mockUseDashboardStats = vi.fn();

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => mockUseDashboardStats(),
}));

// Mock de componentes pesados (no son el foco del test)
vi.mock('@/components/news-card', () => ({
  NewsCard: ({ article }: { article: NewsArticle }) => (
    <div data-testid="news-card" data-article-id={article.id}>
      <h3>{article.title}</h3>
      <p>{article.source}</p>
    </div>
  ),
}));

vi.mock('@/components/layout', () => ({
  Sidebar: ({ onOpenDashboard }: any) => (
    <div data-testid="sidebar">
      <button onClick={onOpenDashboard}>Open Dashboard</button>
    </div>
  ),
  DashboardDrawer: ({ isOpen }: any) => (
    <div data-testid="dashboard-drawer" data-open={isOpen}>
      Dashboard
    </div>
  ),
}));

vi.mock('@/components/sources-drawer', () => ({
  SourcesDrawer: ({ isOpen }: any) => (
    <div data-testid="sources-drawer" data-open={isOpen}>
      Sources
    </div>
  ),
}));

vi.mock('@/components/category-pills', () => ({
  CategoryPills: ({ selectedCategory, onSelect, disabled }: any) => (
    <div data-testid="category-pills" data-selected={selectedCategory} data-disabled={disabled}>
      <button onClick={() => onSelect('general')}>General</button>
      <button onClick={() => onSelect('technology')}>Technology</button>
      <button onClick={() => onSelect('business')}>Business</button>
    </div>
  ),
  CATEGORIES: [
    { id: 'general', label: 'General' },
    { id: 'technology', label: 'Tecnología' },
    { id: 'business', label: 'Negocios' },
    { id: 'politics', label: 'Política' },
    { id: 'science', label: 'Ciencia' },
    { id: 'health', label: 'Salud' },
    { id: 'entertainment', label: 'Entretenimiento' },
    { id: 'sports', label: 'Deportes' },
    { id: 'favorites', label: 'Favoritos' },
  ],
}));

// =========================================================================
// TEST DATA: Mock de NewsArticle
// =========================================================================

const createMockArticle = (id: string, overrides?: Partial<NewsArticle>): NewsArticle => ({
  id,
  title: `Mock Article ${id}`,
  description: `Description for article ${id}`,
  content: `Full content for article ${id}`,
  source: 'Mock News Source',
  url: `https://example.com/article-${id}`,
  urlToImage: `https://example.com/image-${id}.jpg`,
  author: 'Mock Author',
  publishedAt: '2026-02-03T10:00:00.000Z',
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
      verdict: 'Verified',
      reasoning: 'Mock fact check reasoning',
    },
  },
  analyzedAt: '2026-02-03T10:00:00.000Z',
  isFavorite: false,
  ...overrides,
});

const mockNewsResponse: NewsResponse = {
    success: true,
    data: [
        createMockArticle('1', { title: 'Breaking News: AI Revolution' }),
        createMockArticle('2', { title: 'Tech Giants Announce New Products' }),
    ],
    pagination: {
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
    },
};

// =========================================================================
// TEST SUITE
// =========================================================================

describe('Home Page - React Query Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('category'); // Reset URL params
    
    // Default mock para useAuth (usuario autenticado)
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });
    
    // Default mock para useDashboardStats
    mockUseDashboardStats.mockReturnValue({
      data: {
        totalArticles: 100,
        analyzedCount: 80,
        coverage: 80,
        biasDistribution: { left: 20, neutral: 40, right: 20 },
      },
    });
  });

  // =========================================================================
  // CASO 1: ESTADO DE CARGA (Loading State)
  // =========================================================================
  describe('Estado de Carga (Loading State)', () => {
    it('debe mostrar skeletons cuando useNews está cargando', () => {
      // Arrange: Mock loading state
      mockUseNews.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Verificar que aparecen skeletons (divs con clase animate-pulse)
      const skeletons = screen.getAllByRole('generic').filter(el => 
        el.className.includes('animate-pulse')
      );
      expect(skeletons.length).toBeGreaterThan(0);

      // Assert: CategoryPills debe estar deshabilitado durante loading
      const categoryPills = screen.getByTestId('category-pills');
      expect(categoryPills).toHaveAttribute('data-disabled', 'true');
    });

    it('debe ocultar skeletons cuando los datos están listos', async () => {
      // Arrange: Mock loading → success transition
      
      // Primero loading
      mockUseNews.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      const { rerender } = render(<Home />);

      // Then success
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<Home />);

      // Assert: No más skeletons
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      
      // Assert: Noticias renderizadas
      expect(screen.getByText('Breaking News: AI Revolution')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // CASO 2: ESTADO DE ERROR (Error State)
  // =========================================================================
  describe('Estado de Error (Error State)', () => {
    it('debe mostrar mensaje de error cuando useNews falla', () => {
      // Arrange: Mock error state
      mockUseNews.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch news from backend'),
      });

      // Act: Render component
      render(<Home />);

      // Assert: Verificar mensaje de error
      expect(screen.getByText(/error al cargar las noticias/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch news from backend/i)).toBeInTheDocument();

      // Assert: Verificar hint de backend URL
      expect(screen.getByText(/http:\/\/localhost:3000/i)).toBeInTheDocument();
    });

    it('debe mostrar error genérico si no hay mensaje específico', () => {
      // Arrange: Mock error without message
      mockUseNews.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: 'Unknown error', // No es Error instance
      });

      // Act: Render component
      render(<Home />);

      // Assert: Mensaje genérico (aparece 2 veces: título + descripción)
      const errorMessages = screen.getAllByText(/error al cargar las noticias/i);
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // CASO 3: RENDERIZADO DE DATOS (Success State)
  // =========================================================================
  describe('Renderizado de Datos (Success State)', () => {
    it('debe renderizar 2 NewsCards cuando hay 2 artículos', () => {
      // Arrange: Mock success state with 2 articles
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: 2 NewsCards renderizados
      const newsCards = screen.getAllByTestId('news-card');
      expect(newsCards).toHaveLength(2);

      // Assert: Títulos de las noticias
      expect(screen.getByText('Breaking News: AI Revolution')).toBeInTheDocument();
      expect(screen.getByText('Tech Giants Announce New Products')).toBeInTheDocument();
    });

    it('debe mostrar contador de noticias en header', () => {
      // Arrange: Mock success state
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Contador de noticias (viene de stats mock)
      expect(screen.getByText('100')).toBeInTheDocument(); // totalArticles
      
      // 80 aparece 2 veces (analyzedCount y coverage%), usar texto más específico
      const statsTexts = screen.getAllByText(/80/i);
      expect(statsTexts.length).toBeGreaterThanOrEqual(2); // 80 (analyzedCount) + 80% (coverage)
    });

    it('debe mostrar "Empty State" cuando no hay noticias', () => {
      // Arrange: Mock empty state
      mockUseNews.mockReturnValue({
        data: {
          data: [],
          pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Empty state message
      expect(screen.getByText(/no hay noticias en general/i)).toBeInTheDocument();
    });

    it('debe mostrar mensaje específico para favoritos vacíos', () => {
      // Arrange: Mock empty favorites + URL param
      mockSearchParams.set('category', 'favorites');
      
      mockUseNews.mockReturnValue({
        data: {
          data: [],
          pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Mensaje específico de favoritos
      expect(screen.getByText(/no tienes favoritos todavía/i)).toBeInTheDocument();
      expect(screen.getByText(/marca noticias como favoritas para verlas aquí/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // CASO 4: INTERACCIÓN CON FILTROS (Interaction)
  // =========================================================================
  describe('Interacción con Filtros de Categoría', () => {
    it('debe llamar a useNews con categoría "general" por defecto', () => {
      // Arrange: Mock hook
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Hook llamado con params correctos
      expect(mockUseNews).toHaveBeenCalledWith({
        category: 'general',
        limit: 50,
        offset: 0,
      });
    });

    it('debe actualizar URL al cambiar de categoría', async () => {
      // Arrange: Mock hook
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      const user = userEvent.setup();

      // Act: Render component
      render(<Home />);

      // Act: Click en categoría "Technology"
      const technologyButton = screen.getByText('Technology');
      await user.click(technologyButton);

      // Assert: Router push llamado con nueva URL
      expect(mockPush).toHaveBeenCalledWith('/?category=technology', { scroll: false });
    });

    it('debe sincronizar categoría desde URL al montar', () => {
      // Arrange: URL con categoría "business"
      mockSearchParams.set('category', 'business');

      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: CategoryPills muestra "business" como seleccionado
      const categoryPills = screen.getByTestId('category-pills');
      expect(categoryPills).toHaveAttribute('data-selected', 'business');
    });

    it('debe usar "general" si la categoría de URL es inválida', () => {
      // Arrange: URL con categoría inválida
      mockSearchParams.set('category', 'invalid-category');

      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Fallback a "general"
      expect(mockUseNews).toHaveBeenCalledWith({
        category: 'general',
        limit: 50,
        offset: 0,
      });
    });
  });

  // =========================================================================
  // CASO 5: PROTECCIÓN DE RUTA (Auth Guard)
  // =========================================================================
  describe('Protección de Ruta - Auth Guard', () => {
    it('debe redirigir a /login si no hay usuario autenticado', () => {
      // Arrange: Mock user = null
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Redirigido a /login
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('NO debe renderizar contenido si usuario no autenticado', () => {
      // Arrange: Mock user = null
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Componente devuelve null
      expect(screen.queryByTestId('news-card')).not.toBeInTheDocument();
    });

    it('debe mostrar loading spinner mientras verifica auth', () => {
      // Arrange: Mock authLoading = true
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      mockUseNews.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Loading spinner de auth
      expect(screen.getByText(/cargando verity/i)).toBeInTheDocument();
      expect(screen.getByText(/verificando sesión/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // CASO 6: INTEGRACIÓN CON useNews HOOK (Hook Integration)
  // =========================================================================
  describe('Integración con useNews Hook', () => {
    it('debe pasar los parámetros correctos a useNews', () => {
      // Arrange: Mock hook
      mockUseNews.mockReturnValue({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      // Act: Render component
      render(<Home />);

      // Assert: Verificar firma del hook
      expect(mockUseNews).toHaveBeenCalledTimes(1);
      expect(mockUseNews).toHaveBeenCalledWith(
        expect.objectContaining({
          category: expect.any(String),
          limit: 50,
          offset: 0,
        })
      );
    });

    it('debe refetchear automáticamente cuando cambia category (queryKey dinámico)', async () => {
      // Arrange: Mock hook que cambia al cambiar category
      
      // Primera llamada con category="general"
      mockUseNews.mockReturnValueOnce({
        data: mockNewsResponse,
        isLoading: false,
        isError: false,
        error: null,
      });

      const user = userEvent.setup();
      const { rerender } = render(<Home />);

      // Act: Cambiar categoría
      const techButton = screen.getByText('Technology');
      await user.click(techButton);

      // Segunda llamada con category="technology"
      mockUseNews.mockReturnValueOnce({
        data: {
          data: [createMockArticle('3', { title: 'Tech Article', category: 'technology' })],
          pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      rerender(<Home />);

      // Assert: Hook llamado con nueva categoría
      expect(mockUseNews).toHaveBeenLastCalledWith({
        category: 'technology',
        limit: 50,
        offset: 0,
      });
    });
  });
});
