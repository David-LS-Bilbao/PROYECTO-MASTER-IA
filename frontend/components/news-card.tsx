'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toggleFavorite } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { NewsArticle } from '@/lib/api';

interface NewsCardProps {
  article: NewsArticle;
  onFavoriteToggle?: (articleId: string, isFavorite: boolean) => void;
}

/**
 * Get bias level label and color based on score
 */
function getBiasInfo(score: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (score <= 0.2) return { label: 'Neutral', variant: 'default' };
  if (score <= 0.4) return { label: 'Ligero sesgo', variant: 'secondary' };
  if (score <= 0.6) return { label: 'Sesgo moderado', variant: 'outline' };
  if (score <= 0.8) return { label: 'Sesgo alto', variant: 'destructive' };
  return { label: 'Muy sesgado', variant: 'destructive' };
}

/**
 * Format date to relative time or date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Hace menos de 1 hora';
  if (diffHours < 24) return `Hace ${diffHours} horas`;
  if (diffHours < 48) return 'Ayer';

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function NewsCard({ article, onFavoriteToggle }: NewsCardProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(article.isFavorite);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const isAnalyzed = article.analyzedAt !== null;
  // Per-user: user has this in favorites = already analyzed/viewed by them
  const userHasAnalyzed = article.isFavorite && isAnalyzed;
  const biasInfo = article.biasScore !== null ? getBiasInfo(article.biasScore) : null;

  // PRIVACY: Check if analysis exists globally (cached) but user hasn't favorited yet
  const hasGlobalCache = article.hasAnalysis === true && !article.isFavorite;

  /**
   * Navigate to article detail page with auto-analyze flag.
   * The detail page will auto-trigger analysis when ?analyze=true is present.
   */
  const handleAnalyze = () => {
    console.log(`[news-card] 🔵 handleAnalyze clicked for article: ${article.id.substring(0, 8)}...`);
    console.log(`[news-card]    isAnalyzed: ${isAnalyzed}, isFavorite: ${article.isFavorite}`);
    console.log(`[news-card]    Navigating to: /news/${article.id}?analyze=true`);
    router.push(`/news/${article.id}?analyze=true`);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsTogglingFavorite(true);
    const previousState = isFavorite;

    try {
      // Get auth token for per-user favorite
      const token = await getToken();
      if (!token) {
        console.error('No auth token available for favorite toggle');
        return;
      }

      // Optimistic UI update
      setIsFavorite(!isFavorite);

      const response = await toggleFavorite(article.id, token);

      // Notify parent component
      if (onFavoriteToggle) {
        onFavoriteToggle(article.id, response.data.isFavorite);
      }
    } catch (error) {
      // Rollback on error
      setIsFavorite(previousState);
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group relative">
      {/* Favorite Button - Positioned in top-right */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white dark:bg-black/90 dark:hover:bg-black shadow-sm"
        onClick={handleToggleFavorite}
        disabled={isTogglingFavorite}
        title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
      >
        <Heart
          className={`h-5 w-5 transition-colors ${
            isFavorite
              ? 'fill-red-500 text-red-500'
              : 'fill-none text-gray-600 dark:text-gray-300'
          }`}
        />
      </Button>

      {/* Clickable Image */}
      {article.urlToImage && (
        <Link href={`/news/${article.id}`} className="block relative h-48 w-full overflow-hidden">
          <Image
            src={article.urlToImage}
            alt={article.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </Link>
      )}

      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="font-medium">{article.source}</span>
          <span>•</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <Link href={`/news/${article.id}`} className="hover:underline">
          <CardTitle className="line-clamp-2 text-lg">{article.title}</CardTitle>
        </Link>
        {article.description && (
          <CardDescription className="line-clamp-2">
            {article.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analysis Section - Solo badge de sesgo, sin resumen */}
        {isAnalyzed && biasInfo && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Analisis IA</span>
              <Badge variant={biasInfo.variant}>
                {biasInfo.label} ({(article.biasScore! * 100).toFixed(0)}%)
              </Badge>
            </div>
            {article.analysis?.mainTopics && article.analysis.mainTopics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.analysis.mainTopics.slice(0, 3).map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            Fuente
          </a>
        </Button>

        <div className="flex gap-2">
          {userHasAnalyzed ? (
            /* User already analyzed/viewed this article -> "Mostrar analisis" */
            <Button size="sm" variant="outline" asChild>
              <Link href={`/news/${article.id}`}>Mostrar analisis</Link>
            </Button>
          ) : hasGlobalCache ? (
            /* Analysis cached globally but user hasn't favorited -> "Ver analisis" (instant, free) */
            <Button size="sm" variant="secondary" onClick={handleAnalyze}>
              Ver analisis
              <span className="ml-1 text-xs opacity-80">(Instantáneo)</span>
            </Button>
          ) : (
            /* Not analyzed at all -> "Analizar con IA" navigates to detail page */
            <Button
              size="sm"
              onClick={handleAnalyze}
            >
              Analizar con IA
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
