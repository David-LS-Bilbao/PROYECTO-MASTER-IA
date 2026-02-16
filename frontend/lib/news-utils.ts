import { DATE_FORMAT_OPTIONS, LOCALE, UUID_V4_REGEX } from './constants';

/**
 * Bias level configuration and labels
 */
export interface BiasInfo {
  label: string;
  color: string;
  bg: string;
}

export interface BiasDisplayInfo extends BiasInfo {
  scoreText: string;
  showScore: boolean;
  progressValue: number;
}

interface BiasDisplayInput {
  score: number | null | undefined;
  articleLeaning?: 'progresista' | 'conservadora' | 'extremista' | 'neutral' | 'indeterminada';
  leaningConfidence?: 'baja' | 'media' | 'alta';
  biasIndicators?: string[];
  contentLength?: number | null;
  qualityNotice?: string | null;
}

/**
 * Sentiment configuration and display
 */
export interface SentimentInfo {
  label: string;
  emoji: string;
}

/**
 * Get bias level info based on score (0-1)
 */
export function getBiasInfo(score: number): BiasInfo {
  if (score <= 0.2) return { label: 'Neutral', color: 'text-green-700', bg: 'bg-green-100' };
  if (score <= 0.4) return { label: 'Ligero Sesgo', color: 'text-blue-700', bg: 'bg-blue-100' };
  if (score <= 0.6) return { label: 'Sesgo Moderado', color: 'text-amber-700', bg: 'bg-amber-100' };
  if (score <= 0.8) return { label: 'Sesgo Alto', color: 'text-orange-700', bg: 'bg-orange-100' };
  return { label: 'Muy Sesgado', color: 'text-red-700', bg: 'bg-red-100' };
}

export function getBiasDisplayInfo(input: BiasDisplayInput): BiasDisplayInfo {
  const normalizedScore =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.max(0, Math.min(1, input.score))
      : 0;
  const indicatorsCount = Array.isArray(input.biasIndicators) ? input.biasIndicators.length : 0;
  const hasLowQualitySignal =
    input.articleLeaning === 'indeterminada' ||
    typeof input.qualityNotice === 'string' ||
    (typeof input.contentLength === 'number' && input.contentLength < 300);

  if (hasLowQualitySignal) {
    return {
      label: 'Indeterminada',
      color: 'text-zinc-700',
      bg: 'bg-zinc-200',
      scoreText: 'N/A',
      showScore: false,
      progressValue: 0,
    };
  }

  const isLowConfidence = input.leaningConfidence === 'baja' || indicatorsCount < 2;
  if (input.articleLeaning === 'neutral' && isLowConfidence) {
    return {
      label: 'Neutral (confianza baja)',
      color: 'text-green-700',
      bg: 'bg-green-100',
      scoreText: 'N/A',
      showScore: false,
      progressValue: 0,
    };
  }

  const base = getBiasInfo(normalizedScore);
  return {
    ...base,
    scoreText: `${Math.round(normalizedScore * 100)}%`,
    showScore: true,
    progressValue: normalizedScore * 100,
  };
}

/**
 * Get sentiment info with emoji representation
 */
export function getSentimentInfo(sentiment: string): SentimentInfo {
  switch (sentiment) {
    case 'positive':
      return { label: 'Positivo', emoji: '😊' };
    case 'negative':
      return { label: 'Negativo', emoji: '😟' };
    default:
      return { label: 'Neutral', emoji: '😐' };
  }
}

/**
 * Format date to readable Spanish string
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(LOCALE, DATE_FORMAT_OPTIONS);
}

/**
 * Validate if string is a valid UUID v4
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Validate if URL has safe scheme (http/https)
 */
export function isSafeUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
