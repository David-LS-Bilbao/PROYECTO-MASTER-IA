import { DATE_FORMAT_OPTIONS, LOCALE, UUID_V4_REGEX } from './constants';

/**
 * Bias level configuration and labels
 */
export interface BiasInfo {
  label: string;
  color: string;
  bg: string;
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
  if (score <= 0.2) return { label: 'Muy Neutral', color: 'text-green-700', bg: 'bg-green-100' };
  if (score <= 0.4) return { label: 'Ligero Sesgo', color: 'text-blue-700', bg: 'bg-blue-100' };
  if (score <= 0.6) return { label: 'Sesgo Moderado', color: 'text-amber-700', bg: 'bg-amber-100' };
  if (score <= 0.8) return { label: 'Sesgo Alto', color: 'text-orange-700', bg: 'bg-orange-100' };
  return { label: 'Muy Sesgado', color: 'text-red-700', bg: 'bg-red-100' };
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
