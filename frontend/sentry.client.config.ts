/**
 * Sentry Client Configuration for Next.js Frontend
 * Sprint 15: Observabilidad & Analytics
 *
 * Initializes Sentry for:
 * - Error tracking in browser
 * - Performance monitoring (Web Vitals)
 * - Session replay (understand user behavior before error)
 * - User tracking
 */

import * as Sentry from '@sentry/nextjs';

export function initSentryClient() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️ NEXT_PUBLIC_SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    // Sentry project DSN (public, safe to expose)
    dsn,

    // Environment tag for filtering
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring sample rate
    // In production: 10% to avoid high cost
    // In development: 100% to see all traces
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,

    // Session replay sample rate
    // Sample 1% of all sessions
    replaysSessionSampleRate: 0.01,

    // Sample 100% of sessions with an error
    replaysOnErrorSampleRate: 1.0,

    // Attach stack trace to all messages
    attachStacktrace: true,

    // Maximum number of breadcrumbs
    maxBreadcrumbs: 50,

    // Release version
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION || 'unknown',

    // Integrations for browser
    integrations: [
      // Capture session replays (video of user actions before error)
      new Sentry.Replay({
        // Mask all sensitive text to protect user privacy
        maskAllText: true,
        // Block all media (images, etc.) to reduce data transfer
        blockAllMedia: true,
      }),
    ],

    // Before sending event to Sentry
    beforeSend: (event, hint) => {
      // Filter out expected client errors
      if (event.exception) {
        const error = hint.originalException;

        if (error instanceof Error) {
          // Don't send auth errors (expected)
          if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
            return null;
          }

          // Don't send 404s (user navigated to non-existent page)
          if (error.message.includes('404')) {
            return null;
          }

          // Don't send network errors from extensions
          if (error.message.includes('chrome-extension')) {
            return null;
          }
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry client initialized');
}

/**
 * Set user context for error tracking
 * Call this after user authentication
 */
export function setSentryUser(userId: string, userEmail?: string, userName?: string): void {
  Sentry.setUser({
    id: userId,
    email: userEmail,
    username: userName,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture exception manually
 * Use for errors that don't get caught by Sentry automatically
 */
export function captureSentryException(error: Error | unknown, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    tags: {
      source: 'frontend',
    },
    extra: context,
  });
}

/**
 * Add breadcrumb for contextual logging
 */
export function addSentryBreadcrumb(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

export { Sentry };
