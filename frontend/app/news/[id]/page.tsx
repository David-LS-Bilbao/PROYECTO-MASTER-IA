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
import { NewsChatDrawer } from '@/components/news-chat-drawer';

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

      {/* Chat Drawer - Only show if article has content */}
      {(article.content || article.description) && (
        <NewsChatDrawer articleId={article.id} articleTitle={article.title} />
      )}

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
