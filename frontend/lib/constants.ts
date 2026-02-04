/**
 * Application-wide constants
 */

// Security & Validation
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rate Limiting
export const ANALYSIS_COOLDOWN_MS = 10000; // 10 seconds

// Date Formatting
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export const LOCALE = 'es-ES';
