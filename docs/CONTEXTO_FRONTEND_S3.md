# Contexto Frontend - Sprint 3 (Chat Component)

---

## 1. frontend/app/news/[id]/page.tsx

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Markdown from 'react-markdown';
import { fetchNewsById } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BiasMeter, BiasExplanation } from '@/components/bias-meter';
import { ArticleImage } from '@/components/article-image';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get sentiment badge variant
 */
function getSentimentInfo(sentiment: string): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  switch (sentiment) {
    case 'positive':
      return { label: 'Positivo', variant: 'default' };
    case 'negative':
      return { label: 'Negativo', variant: 'destructive' };
    default:
      return { label: 'Neutral', variant: 'secondary' };
  }
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { id } = await params;

  let article = null;
  let error = null;

  try {
    const response = await fetchNewsById(id);
    article = response.data;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido';
    console.error('Error fetching article:', e);
  }

  // Handle 404
  if (!article && error?.includes('404')) {
    notFound();
  }

  // Handle other errors
  if (error || !article) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="text-6xl mb-4">😵</div>
              <h1 className="text-2xl font-bold mb-2">Error al cargar la noticia</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button asChild>
                <Link href="/">Volver al inicio</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isAnalyzed = article.analyzedAt !== null;
  const sentimentInfo = article.analysis?.sentiment
    ? getSentimentInfo(article.analysis.sentiment)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 dark:border-zinc-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                Verity News
              </span>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/">Volver al Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto">
          {/* Article Header */}
          <header className="mb-8">
            {/* Image */}
            {article.urlToImage && (
              <div className="relative h-64 md:h-96 w-full rounded-xl overflow-hidden mb-6">
                <ArticleImage
                  src={article.urlToImage}
                  alt={article.title}
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              <Badge variant="outline">{article.source}</Badge>
              {article.category && <Badge variant="secondary">{article.category}</Badge>}
              <span>{formatDate(article.publishedAt)}</span>
              {article.author && <span>por {article.author}</span>}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              {article.title}
            </h1>

            {/* Description */}
            {article.description && (
              <p className="text-xl text-muted-foreground leading-relaxed">
                {article.description}
              </p>
            )}
          </header>

          <Separator className="my-8" />

          {/* AI Analysis Section */}
          {isAnalyzed && article.biasScore !== null && (
            <>
              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-2xl">🤖</span> Análisis de IA
                </h2>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Bias Score Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Nivel de Sesgo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <BiasMeter score={article.biasScore} size="lg" />
                      <BiasExplanation score={article.biasScore} />
                    </CardContent>
                  </Card>

                  {/* Sentiment & Topics Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sentimiento y Temas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sentimentInfo && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Sentimiento:</span>
                          <Badge variant={sentimentInfo.variant}>{sentimentInfo.label}</Badge>
                        </div>
                      )}

                      {article.analysis?.mainTopics && article.analysis.mainTopics.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground block mb-2">
                            Temas principales:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {article.analysis.mainTopics.map((topic, i) => (
                              <Badge key={i} variant="outline">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Summary */}
                {article.summary && (
                  <Card className="mt-6 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Resumen del Análisis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg leading-relaxed">{article.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Bias Indicators */}
                {article.analysis?.biasIndicators && article.analysis.biasIndicators.length > 0 && (
                  <Card className="mt-6 border-l-4 border-l-amber-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Indicadores de Sesgo Detectados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {article.analysis.biasIndicators.map((indicator, i) => (
                          <li key={i}>{indicator}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Factual Claims */}
                {article.analysis?.factualClaims && article.analysis.factualClaims.length > 0 && (
                  <Card className="mt-6 border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="text-lg">Afirmaciones Factuales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {article.analysis.factualClaims.map((claim, i) => (
                          <li key={i}>{claim}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </section>

              <Separator className="my-8" />
            </>
          )}

          {/* Not Analyzed Banner */}
          {!isAnalyzed && (
            <>
              <Card className="mb-8 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">⚠️</span>
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-1">
                        Artículo sin analizar
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Este artículo aún no ha sido procesado por nuestra IA.
                        Vuelve al dashboard y usa el botón &quot;Analizar con IA&quot;.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-8" />
            </>
          )}

          {/* Article Content */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Contenido del Artículo</h2>

            {article.content ? (
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <Markdown>{article.content}</Markdown>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    El contenido completo no está disponible. Visita la fuente original para leer el artículo.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          <Separator className="my-8" />

          {/* Action Buttons */}
          <footer className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Ver fuente original ↗
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/">Volver al Dashboard</Link>
            </Button>
          </footer>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-zinc-900 dark:border-zinc-800 mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            Verity News - Análisis de sesgo en noticias con IA |{' '}
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </footer>
    </div>
  );
}
```

---

## 2. frontend/lib/api.ts

```typescript
/**
 * API Client for Verity News Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ArticleAnalysis {
  summary: string;
  biasScore: number;
  biasIndicators: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factualClaims: string[];
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  author: string | null;
  publishedAt: string;
  category: string | null;
  language: string;
  summary: string | null;
  biasScore: number | null;
  analysis: ArticleAnalysis | null;
  analyzedAt: string | null;
}

export interface NewsResponse {
  success: boolean;
  data: NewsArticle[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AnalyzeResponse {
  success: boolean;
  data: {
    articleId: string;
    summary: string;
    biasScore: number;
    analysis: ArticleAnalysis;
    scrapedContentLength: number;
  };
  message: string;
}

/**
 * Fetch all news articles from the backend
 */
export async function fetchNews(limit = 50, offset = 0): Promise<NewsResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/news?limit=${limit}&offset=${offset}`,
    {
      cache: 'no-store', // Disable cache for development
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch news: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch a single news article by ID
 */
export async function fetchNewsById(id: string): Promise<{ success: boolean; data: NewsArticle }> {
  const res = await fetch(`${API_BASE_URL}/api/news/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Analyze a single article with AI
 */
export async function analyzeArticle(articleId: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analyze/article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ articleId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to analyze article: ${res.status}`);
  }

  return res.json();
}

/**
 * Get analysis statistics
 */
export async function fetchAnalysisStats(): Promise<{
  success: boolean;
  data: {
    total: number;
    analyzed: number;
    pending: number;
    percentAnalyzed: number;
  };
}> {
  const res = await fetch(`${API_BASE_URL}/api/analyze/stats`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
```

---

## 3. frontend/components/ui/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

---

## 4. backend/src/domain/entities/news-article.entity.ts

```typescript
/**
 * NewsArticle Entity (Domain Layer)
 * Pure domain entity - NO external dependencies
 */

export interface NewsArticleProps {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  author: string | null;
  publishedAt: Date;
  category: string | null;
  language: string;
  embedding: string | null;
  // AI Analysis fields
  summary: string | null;
  biasScore: number | null;
  analysis: string | null;
  analyzedAt: Date | null;
  // Metadata
  fetchedAt: Date;
  updatedAt: Date;
}

export interface ArticleAnalysis {
  summary: string;
  biasScore: number;
  biasIndicators: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factualClaims: string[];
}

export class NewsArticle {
  private constructor(private readonly props: NewsArticleProps) {
    this.validate();
  }

  private validate(): void {
    if (!this.props.id || this.props.id.trim() === '') {
      throw new Error('NewsArticle ID is required');
    }
    if (!this.props.title || this.props.title.trim() === '') {
      throw new Error('NewsArticle title is required');
    }
    if (!this.props.url || this.props.url.trim() === '') {
      throw new Error('NewsArticle URL is required');
    }
    if (!this.props.source || this.props.source.trim() === '') {
      throw new Error('NewsArticle source is required');
    }
  }

  static create(props: NewsArticleProps): NewsArticle {
    return new NewsArticle(props);
  }

  static reconstitute(props: NewsArticleProps): NewsArticle {
    return new NewsArticle(props);
  }

  get id(): string {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get content(): string | null {
    return this.props.content;
  }

  get url(): string {
    return this.props.url;
  }

  get urlToImage(): string | null {
    return this.props.urlToImage;
  }

  get source(): string {
    return this.props.source;
  }

  get author(): string | null {
    return this.props.author;
  }

  get publishedAt(): Date {
    return this.props.publishedAt;
  }

  get category(): string | null {
    return this.props.category;
  }

  get language(): string {
    return this.props.language;
  }

  get embedding(): string | null {
    return this.props.embedding;
  }

  get summary(): string | null {
    return this.props.summary;
  }

  get biasScore(): number | null {
    return this.props.biasScore;
  }

  get analysis(): string | null {
    return this.props.analysis;
  }

  get analyzedAt(): Date | null {
    return this.props.analyzedAt;
  }

  get fetchedAt(): Date {
    return this.props.fetchedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isAnalyzed(): boolean {
    return this.props.analyzedAt !== null;
  }

  /**
   * Get parsed analysis object
   */
  getParsedAnalysis(): ArticleAnalysis | null {
    if (!this.props.analysis) return null;
    try {
      return JSON.parse(this.props.analysis) as ArticleAnalysis;
    } catch {
      return null;
    }
  }

  /**
   * Create a new instance with analysis data
   */
  withAnalysis(analysis: ArticleAnalysis): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      summary: analysis.summary,
      biasScore: analysis.biasScore,
      analysis: JSON.stringify(analysis),
      analyzedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Create a new instance with full content (from scraping)
   */
  withFullContent(content: string): NewsArticle {
    return NewsArticle.reconstitute({
      ...this.props,
      content,
      updatedAt: new Date(),
    });
  }

  toJSON(): NewsArticleProps {
    return { ...this.props };
  }
}
```

---

## 5. backend/src/application/use-cases/analyze-article.usecase.ts

```typescript
/**
 * AnalyzeArticleUseCase
 */

import { ArticleAnalysis } from '../../domain/entities/news-article.entity';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient } from '../../domain/services/gemini-client.interface';
import { IJinaReaderClient } from '../../domain/services/jina-reader-client.interface';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

export interface AnalyzeArticleInput {
  articleId: string;
}

export interface AnalyzeArticleOutput {
  articleId: string;
  summary: string;
  biasScore: number;
  analysis: ArticleAnalysis;
  scrapedContentLength: number;
}

export interface AnalyzeBatchInput {
  limit: number;
}

export interface AnalyzeBatchOutput {
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    articleId: string;
    success: boolean;
    error?: string;
  }>;
}

export class AnalyzeArticleUseCase {
  constructor(
    private readonly articleRepository: INewsArticleRepository,
    private readonly geminiClient: IGeminiClient,
    private readonly jinaReaderClient: IJinaReaderClient
  ) {}

  /**
   * Analyze a single article by ID
   */
  async execute(input: AnalyzeArticleInput): Promise<AnalyzeArticleOutput> {
    const { articleId } = input;

    // Validate input
    if (!articleId || articleId.trim() === '') {
      throw new ValidationError('Article ID is required');
    }

    // 1. Fetch article from database
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    // 2. Check if already analyzed
    if (article.isAnalyzed) {
      const existingAnalysis = article.getParsedAnalysis();
      if (existingAnalysis) {
        return {
          articleId: article.id,
          summary: article.summary!,
          biasScore: article.biasScore!,
          analysis: existingAnalysis,
          scrapedContentLength: article.content?.length || 0,
        };
      }
    }

    // 3. Scrape full content if needed
    let contentToAnalyze = article.content;
    let scrapedContentLength = contentToAnalyze?.length || 0;

    if (!contentToAnalyze || contentToAnalyze.length < 100) {
      const scrapedContent = await this.scrapeArticleContent(article.url);

      if (!scrapedContent) throw new Error("Jina devolvió contenido vacío");

      contentToAnalyze = scrapedContent;
      scrapedContentLength = scrapedContent.length;

      // Update article with scraped content
      const articleWithContent = article.withFullContent(scrapedContent);
      await this.articleRepository.save(articleWithContent);
    }

    // 4. Analyze with Gemini
    const analysis = await this.geminiClient.analyzeArticle({
      title: article.title,
      content: contentToAnalyze,
      source: article.source,
      language: article.language,
    });

    // 5. Update article with analysis
    const analyzedArticle = article.withAnalysis(analysis);
    await this.articleRepository.save(analyzedArticle);

    return {
      articleId: article.id,
      summary: analysis.summary,
      biasScore: analysis.biasScore,
      analysis,
      scrapedContentLength,
    };
  }

  /**
   * Analyze multiple unanalyzed articles in batch
   */
  async executeBatch(input: AnalyzeBatchInput): Promise<AnalyzeBatchOutput> {
    const { limit } = input;

    if (limit <= 0 || limit > 100) {
      throw new ValidationError('Batch limit must be between 1 and 100');
    }

    const unanalyzedArticles = await this.articleRepository.findUnanalyzed(limit);

    const results: AnalyzeBatchOutput['results'] = [];
    let successful = 0;
    let failed = 0;

    for (const article of unanalyzedArticles) {
      try {
        await this.execute({ articleId: article.id });
        results.push({ articleId: article.id, success: true });
        successful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ articleId: article.id, success: false, error: errorMessage });
        failed++;
      }
    }

    return {
      processed: unanalyzedArticles.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get analysis statistics
   */
  async getStats(): Promise<{
    total: number;
    analyzed: number;
    pending: number;
    percentAnalyzed: number;
  }> {
    const total = await this.articleRepository.count();
    const analyzed = await this.articleRepository.countAnalyzed();
    const pending = total - analyzed;
    const percentAnalyzed = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return { total, analyzed, pending, percentAnalyzed };
  }

  /**
   * Scrape article content using Jina Reader
   */
  private async scrapeArticleContent(url: string): Promise<string> {
    try {
      const scraped = await this.jinaReaderClient.scrapeUrl(url);
      return scraped.content;
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError(
        'JinaReader',
        `Failed to scrape URL: ${url}`,
        500,
        error as Error
      );
    }
  }
}
```

---

## Resumen de Interfaces Clave

### ArticleAnalysis (Backend y Frontend)
```typescript
interface ArticleAnalysis {
  summary: string;
  biasScore: number;
  biasIndicators: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factualClaims: string[];
}
```

### NewsArticle (Frontend)
```typescript
interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  author: string | null;
  publishedAt: string;
  category: string | null;
  language: string;
  summary: string | null;
  biasScore: number | null;
  analysis: ArticleAnalysis | null;
  analyzedAt: string | null;
}
```

### Button Variants (shadcn/ui)
- `variant`: default | destructive | outline | secondary | ghost | link
- `size`: default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg
