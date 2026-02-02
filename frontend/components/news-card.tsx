'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
import { analyzeArticle, toggleFavorite } from '@/lib/api';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(article.isFavorite);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const isAnalyzed = article.analyzedAt !== null;
  const biasInfo = article.biasScore !== null ? getBiasInfo(article.biasScore) : null;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Get authentication token
      const token = await getToken();
      if (!token) {
        setAnalysisError('No se pudo obtener el token de autenticación');
        return;
      }

      const analysisResult = await analyzeArticle(article.id, token);
      
      // Reload the page to show updated analysis
      window.location.reload();
    } catch (error) {
      console.error('Error analyzing article:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Error al analizar');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsTogglingFavorite(true);
    const previousState = isFavorite;

    try {
      // Optimistic UI update
      setIsFavorite(!isFavorite);
      
      const response = await toggleFavorite(article.id);
      
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
        {/* Analysis Section */}
        {isAnalyzed && biasInfo && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Análisis IA</span>
              <Badge variant={biasInfo.variant}>
                {biasInfo.label} ({(article.biasScore! * 100).toFixed(0)}%)
              </Badge>
            </div>
            {article.summary && (
              <p className="text-sm text-muted-foreground">{article.summary}</p>
            )}
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

        {/* Error message */}
        {analysisError && (
          <div className="p-3 rounded-lg text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {analysisError}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            Fuente ↗
          </a>
        </Button>

        <div className="flex gap-2">
          {isAnalyzed ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/news/${article.id}`}>Ver análisis</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analizando...
                </>
              ) : (
                'Analizar con IA'
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
