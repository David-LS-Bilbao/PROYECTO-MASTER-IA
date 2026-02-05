/**
 * Sentry Server Configuration for Next.js Backend/API Routes
 * Sprint 15: Observabilidad & Analytics
 *
 * Initializes Sentry for server-side operations:
 * - API route errors
 * - Server-side rendering (SSR) errors
 * - Performance of API calls
 */

import * as Sentry from '@sentry/nextjs';

export function initSentryServer() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not configured. Error tracking disabled on server.');
    return;
  }

  Sentry.init({
    // Use SENTRY_DSN (non-public, only for server)
    dsn,

    // Environment tag
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,

    // Attach stack traces
    attachStacktrace: true,

    // Release version
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION || 'unknown',

    // List of errors to ignore
    ignoreErrors: [
      // Browser-only errors
      'top.GLOBALS',
      'chrome-extension://',
      // Network errors
      'Network request failed',
      'Failed to fetch',
    ],
  });

  console.log('✅ Sentry server initialized');
}

export { Sentry };
