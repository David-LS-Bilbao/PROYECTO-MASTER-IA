'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Clock, User, Tag, Sparkles } from 'lucide-react';
import { analyzeArticle, type NewsArticle, type AnalyzeResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useArticle } from '@/hooks/useArticle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ReliabilityBadge } from '@/components/reliability-badge';
import { NewsChatDrawer } from '@/components/news-chat-drawer';

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
 * Get bias level info
 */
function getBiasInfo(score: number): { label: string; color: string; bg: string } {
  if (score <= 0.2) return { label: 'Muy Neutral', color: 'text-green-700', bg: 'bg-green-100' };
  if (score <= 0.4) return { label: 'Ligero Sesgo', color: 'text-blue-700', bg: 'bg-blue-100' };
  if (score <= 0.6) return { label: 'Sesgo Moderado', color: 'text-amber-700', bg: 'bg-amber-100' };
  if (score <= 0.8) return { label: 'Sesgo Alto', color: 'text-orange-700', bg: 'bg-orange-100' };
  return { label: 'Muy Sesgado', color: 'text-red-700', bg: 'bg-red-100' };
}

/**
 * Get sentiment info
 */
function getSentimentInfo(sentiment: string): { label: string; emoji: string } {
  switch (sentiment) {
    case 'positive': return { label: 'Positivo', emoji: '😊' };
    case 'negative': return { label: 'Negativo', emoji: '😟' };
    default: return { label: 'Neutral', emoji: '😐' };
  }
}

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
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const id = params.id as string;

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

  // Redirect to not-found if 404 error
  useEffect(() => {
    if (isError && queryError?.message.includes('404')) {
      router.push('/news/not-found');
    }
  }, [isError, queryError, router]);

  // Sanitize HTML content to prevent XSS attacks
  // Must be before any conditional returns to follow Rules of Hooks
  const sanitizedContent = useMemo(() => {
    if (!article?.content) return '';
    return DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'img'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class'],
    });
  }, [article?.content]);

  const handleAnalyze = async () => {
    if (!article) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      // Get authentication token
      const token = await getToken();
      if (!token) {
        setAnalyzeError('No se pudo obtener el token de autenticación');
        return;
      }

      await analyzeArticle(article.id, token);

      // Invalidate query cache to refetch article with new analysis
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Error al analizar');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return <ArticleSkeleton />;
  }

  if (isError || !article) {
    const errorMessage = queryError?.message || 'Error al cargar la noticia';
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

            {/* Description / Summary */}
            {article.description && (
              <div className="mb-6">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {article.description}
                </p>
              </div>
            )}

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

            {/* Source Link */}
            <Button size="lg" className="gap-2" asChild>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Leer noticia completa en {article.source}
              </a>
            </Button>
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
                {isAnalyzed && biasInfo ? (
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
                    </div>

                    {/* Reliability Score - Detector de Bulos */}
                    {article.analysis?.reliabilityScore !== undefined && (
                      <div className="p-4 border rounded-lg bg-white dark:bg-zinc-800">
                        <ReliabilityBadge
                          score={article.analysis.reliabilityScore}
                          reasoning={article.analysis.factCheck?.reasoning}
                        />
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

                    {/* Summary */}
                    {article.summary && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Resumen IA</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {article.summary}
                        </p>
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
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Re-analizando...
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
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? (
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
      <NewsChatDrawer articleId={article.id} articleTitle={article.title} />
    </div>
  );
}
