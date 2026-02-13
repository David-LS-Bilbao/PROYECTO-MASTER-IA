'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Clock, User, Tag, Sparkles } from 'lucide-react';
import { analyzeArticle, type NewsArticle, type AnalyzeResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useArticle } from '@/hooks/useArticle';
import { formatDate, getBiasInfo, getSentimentInfo, isValidUUID, isSafeUrl } from '@/lib/news-utils';
import { ANALYSIS_COOLDOWN_MS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ReliabilityBadge } from '@/components/reliability-badge';
import { NewsChatDrawer } from '@/components/news-chat-drawer';
import { GeneralChatDrawer } from '@/components/general-chat-drawer';

/**
 * Loading skeleton for the article
 */
function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 dark:border-zinc-800">
        <div className="container mx-auto px-4 py-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 md:w-[60%]">
            <Skeleton className="h-64 md:h-96 w-full rounded-xl mb-6" />
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2 mb-6" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="md:w-[40%]">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const shouldAutoAnalyze = searchParams.get('analyze') === 'true';

  // Validate UUID format to prevent injection attacks
  const validUUID = isValidUUID(id);

  // Redirect immediately if invalid UUID
  useEffect(() => {
    if (!validUUID) {
      router.push('/news/not-found');
    }
  }, [validUUID, router]);

  // React Query: Fetch article data
  const { 
    data: article, 
    isLoading, 
    isError, 
    error: queryError 
  } = useArticle({ id });

  // Local state for AI analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [lastAnalyzeTime, setLastAnalyzeTime] = useState<number>(0);

  // =========================================================================
  // SPRINT 18.3: ARTIFICIAL REVEAL STATE - UX Enhancement
  // =========================================================================
  // PROBLEMA: When analysis is already available (cached + unlocked), it appears
  // instantly, eliminating the perception of AI value and processing effort.
  //
  // SOLUCIÓN: Apply a fake delay (1.8s) to simulate AI processing even when
  // data is already available. Show skeleton during reveal.
  //
  // BENEFICIO: Maintains consistent UX, creates anticipation, and preserves
  // perceived value of AI analysis regardless of cache status.
  // =========================================================================
  const [isRevealing, setIsRevealing] = useState(false);

  // =========================================================================
  // SPRINT 29: GRACEFUL DEGRADATION - General Chat Fallback
  // =========================================================================
  const [isGeneralChatOpen, setIsGeneralChatOpen] = useState(false);
  const [generalChatInitialQuestion, setGeneralChatInitialQuestion] = useState('');

  // Redirect to not-found if 404 error
  useEffect(() => {
    if (isError && queryError?.message.includes('404')) {
      router.push('/news/not-found');
    }
  }, [isError, queryError, router]);

  // Auto-trigger state (must be declared before handleAnalyze for hooks order)
  const [autoAnalyzeTriggered, setAutoAnalyzeTriggered] = useState(false);

  // Sanitize HTML content to prevent XSS attacks
  // Must be before any conditional returns to follow Rules of Hooks
  const sanitizedContent = useMemo(() => {
    if (!article?.content) return '';
    return DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i, // Only HTTP(S) and mailto URLs
    });
  }, [article?.content]);

  const handleAnalyze = async () => {
    if (!article) {
      return;
    }

    // Rate limiting: cooldown to prevent spam
    const now = Date.now();
    if (now - lastAnalyzeTime < ANALYSIS_COOLDOWN_MS) {
      setAnalyzeError(`Espera ${ANALYSIS_COOLDOWN_MS / 1000} segundos antes de re-analizar`);
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setLastAnalyzeTime(now);

    try {
      // Get authentication token
      const token = await getToken();
      if (!token) {
        setAnalyzeError('No se pudo obtener el token de autenticación');
        return;
      }

      const result = await analyzeArticle(article.id, token);

      // Invalidate caches to refetch article and update dashboard buttons
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['news'] });
    } catch (e) {
      console.error(`[page.tsx]    ❌ Analysis failed:`, e);
      setAnalyzeError(e instanceof Error ? e.message : 'Error al analizar');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-trigger analysis when navigating from card with ?analyze=true
  useEffect(() => {
    if (!shouldAutoAnalyze || autoAnalyzeTriggered || !article || isAnalyzing) {
      return;
    }

    // Case 1: Article not analyzed at all → trigger fresh analysis
    // Case 2: Article analyzed globally but user hasn't seen it → trigger to add auto-favorite
    if (!article.analyzedAt || (article.analyzedAt && !article.isFavorite)) {
      setAutoAnalyzeTriggered(true);
      handleAnalyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoAnalyze, autoAnalyzeTriggered, article]);

  // =========================================================================
  // SPRINT 18.3: Artificial Reveal Delay for Pre-loaded Analysis
  // =========================================================================
  // When user comes with ?analyze=true but analysis is already available
  // (user has it unlocked from before), apply fake delay to maintain UX value
  // =========================================================================
  useEffect(() => {
    // Only apply reveal delay if:
    // 1. User came with ?analyze=true intent
    // 2. Article is already analyzed (data available)
    // 3. Not currently analyzing (no API call in progress)
    // 4. Not already revealing
    const shouldReveal = shouldAutoAnalyze && article?.analyzedAt && !isAnalyzing && !isRevealing;

    if (!shouldReveal) {
      return;
    }

    setIsRevealing(true);

    const REVEAL_DELAY = 1800; // 1.8 seconds
    const timer = setTimeout(() => {
      setIsRevealing(false);
    }, REVEAL_DELAY);

    return () => clearTimeout(timer);
  }, [shouldAutoAnalyze, article?.analyzedAt, isAnalyzing, isRevealing]);

  if (isLoading) {
    return <ArticleSkeleton />;
  }

  if (isError || !article) {
    // Sanitize error messages - don't expose technical details
    const errorMessage = queryError?.message?.includes('404')
      ? 'La noticia no existe o ha sido eliminada'
      : 'Error al cargar la noticia. Intenta de nuevo más tarde.';
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold mb-2">Error al cargar la noticia</h1>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <Button asChild>
              <Link href="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAnalyzed = article.analyzedAt !== null;
  const biasInfo = article.biasScore !== null ? getBiasInfo(article.biasScore) : null;
  const sentimentInfo = article.analysis?.sentiment ? getSentimentInfo(article.analysis.sentiment) : null;
  const biasLeaningLabels: Record<'progresista' | 'conservadora' | 'neutral' | 'indeterminada' | 'otra', string> = {
    progresista: 'Progresista',
    conservadora: 'Conservadora',
    neutral: 'Neutral',
    indeterminada: 'Indeterminada',
    otra: 'Otra',
  };

  // Determine if we should show analysis content or skeleton
  // Show skeleton if: analyzing OR revealing (artificial delay)
  const showAnalysisSkeleton = isAnalyzing || isRevealing;
  const showAnalysisContent = isAnalyzed && !showAnalysisSkeleton;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 dark:border-zinc-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" asChild className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </Button>
            <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-white">
              Verity News
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Article Content (60%) */}
          <article className="flex-1 lg:w-[60%]">
            {/* Cover Image */}
            {article.urlToImage && (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-6 bg-zinc-200 dark:bg-zinc-800">
                <Image
                  src={article.urlToImage}
                  alt={article.title}
                  fill
                  className="object-cover"
                  priority
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4 leading-tight">
              {article.title}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
              <Badge variant="default" className="font-medium">
                {article.source}
              </Badge>
              {article.category && (
                <Badge variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {article.category}
                </Badge>
              )}
              {article.author && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {article.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(article.publishedAt)}
              </span>
            </div>

            <Separator className="my-6" />

            {/* AI Summary - Show skeleton while revealing, then show content */}
            {showAnalysisSkeleton ? (
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-4 bg-purple-300 dark:bg-purple-700 rounded"></div>
                  <div className="h-4 w-32 bg-purple-300 dark:bg-purple-700 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-full"></div>
                  <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-11/12"></div>
                  <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-10/12"></div>
                </div>
              </div>
            ) : showAnalysisContent && article.summary ? (
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                    Resumen Verity AI
                  </h3>
                </div>
                <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {article.summary}
                </p>
              </div>
            ) : null}

            {/* Content - Sanitized to prevent XSS */}
            {sanitizedContent ? (
              <div className="prose prose-zinc dark:prose-invert max-w-none mb-8">
                <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
              </div>
            ) : (
              <Card className="border-dashed mb-8">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    El contenido completo no está disponible. Visita la fuente original para leer el artículo.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Source Link - Validate URL scheme */}
            {isSafeUrl(article.url) ? (
              <Button size="lg" className="gap-2" asChild>
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Leer noticia completa en {article.source}
                </a>
              </Button>
            ) : (
              <p className="text-sm text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                URL no válida o insegura
              </p>
            )}
          </article>

          {/* Right Column - AI Analysis Panel (40%) */}
          <aside className="lg:w-[40%] lg:sticky lg:top-24 lg:self-start">
            <Card className="border bg-gray-50 dark:bg-zinc-900">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Análisis de Verity AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {showAnalysisSkeleton ? (
                  // ========== SKELETON DURING ANALYSIS/REVEAL ==========
                  <div className="space-y-6 animate-pulse">
                    {/* Bias Score Skeleton */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                        <div className="h-6 w-20 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                      </div>
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full"></div>
                      <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                    </div>

                    {/* Reliability Skeleton */}
                    <div className="p-4 border rounded-lg bg-white dark:bg-zinc-800 space-y-2">
                      <div className="h-5 w-40 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                      <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                      <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                    </div>

                    {/* Sentiment Skeleton */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg">
                      <div className="h-4 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                      <div className="h-6 w-16 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                    </div>

                    {/* Topics Skeleton */}
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                      <div className="flex flex-wrap gap-2">
                        <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                        <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
                      </div>
                    </div>

                    <div className="h-10 w-full bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                  </div>
                ) : showAnalysisContent && biasInfo ? (
                  // ========== ACTUAL ANALYSIS CONTENT ==========
                  <>
                    {/* Bias Score */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Nivel de Sesgo</span>
                        <span className={`text-sm font-semibold px-2 py-1 rounded ${biasInfo.bg} ${biasInfo.color}`}>
                          {biasInfo.label}
                        </span>
                      </div>
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-green-500 via-amber-500 to-red-500 rounded-full transition-all"
                          style={{ width: `${(article.biasScore ?? 0) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Puntuación: {((article.biasScore ?? 0) * 100).toFixed(0)}% de sesgo detectado
                      </p>
                      {article.analysis?.biasComment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {article.analysis.biasComment}
                        </p>
                      )}
                      {article.analysis?.biasLeaning && (
                        <p className="text-xs text-muted-foreground">
                          Tendencia estimada: {biasLeaningLabels[article.analysis.biasLeaning]}
                        </p>
                      )}
                    </div>

                    {/* Reliability Score - Detector de Bulos */}
                    {article.analysis?.reliabilityScore !== undefined && (
                      <div className="p-4 border rounded-lg bg-white dark:bg-zinc-800">
                        <ReliabilityBadge
                          score={article.analysis.reliabilityScore}
                          traceabilityScore={article.analysis.traceabilityScore}
                          factualityStatus={article.analysis.factualityStatus}
                          clickbaitScore={article.analysis.clickbaitScore}
                          shouldEscalate={article.analysis.should_escalate}
                          reasoning={article.analysis.factCheck?.reasoning}
                        />
                        {article.analysis.reliabilityComment && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                            {article.analysis.reliabilityComment}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Sentiment */}
                    {sentimentInfo && (
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg">
                        <span className="text-sm font-medium">Sentimiento</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xl">{sentimentInfo.emoji}</span>
                          <span className="text-sm">{sentimentInfo.label}</span>
                        </span>
                      </div>
                    )}

                    {/* Topics */}
                    {article.analysis?.mainTopics && article.analysis.mainTopics.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Temas Principales</h4>
                        <div className="flex flex-wrap gap-2">
                          {article.analysis.mainTopics.map((topic, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bias Indicators */}
                    {article.analysis?.biasIndicators && article.analysis.biasIndicators.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-amber-600">Indicadores de Sesgo</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {article.analysis.biasIndicators.slice(0, 3).map((indicator, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {indicator}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Re-analyze button */}
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || isRevealing}
                    >
                      {isAnalyzing || isRevealing ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          {isRevealing ? 'Procesando...' : 'Re-analizando...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Re-analizar
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Not Analyzed State */}
                    <div className="text-center py-6">
                      <div className="text-5xl mb-4">🔍</div>
                      <h3 className="font-semibold mb-2">Sin analizar</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Haz clic para analizar esta noticia con nuestra IA y detectar posibles sesgos.
                      </p>
                      <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || isRevealing}
                      >
                        {isAnalyzing || isRevealing ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            Analizando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5" />
                            Analizar Veracidad
                          </>
                        )}
                      </Button>
                      {analyzeError && (
                        <p className="text-sm text-red-500 mt-3">{analyzeError}</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
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

      {/* Floating Chat Button - RAG-powered conversation with the article */}
      <NewsChatDrawer
        articleId={article.id}
        articleTitle={article.title}
        onOpenGeneralChat={(question) => {
          setGeneralChatInitialQuestion(question);
          setIsGeneralChatOpen(true);
        }}
      />

      {/* Sprint 29: General Chat Drawer - Fallback for out-of-domain questions */}
      <GeneralChatDrawer
        isOpen={isGeneralChatOpen}
        onOpenChange={setIsGeneralChatOpen}
        initialQuestion={generalChatInitialQuestion}
      />
    </div>
  );
}
