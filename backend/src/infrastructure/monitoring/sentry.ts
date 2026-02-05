/**
 * Sentry Configuration for Node.js Backend
 * Sprint 15: Observabilidad & Analytics
 *
 * Initializes Sentry for:
 * - Error tracking and exception capturing
 * - Performance monitoring (distributed tracing)
 * - Profiling (CPU, memory, throughput)
 * - Breadcrumbs (contextual logging)
 *
 * Must be initialized BEFORE any other code runs.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initialize Sentry for Express backend
 * Call this function at the very beginning of your app (before middleware)
 */
export function initSentry(): void {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    // Sentry project DSN
    dsn,

    // Environment tag for filtering (production/staging/development)
    environment: process.env.NODE_ENV || 'development',

    // Integrations for various services
    integrations: [
      // Enable Node.js profiling (CPU, memory, throughput)
      nodeProfilingIntegration(),

      // Capture HTTP requests and responses
      new Sentry.Integrations.Http({ tracing: true }),

      // Capture uncaught exceptions
      new Sentry.Integrations.OnUncaughtException(),

      // Capture unhandled promise rejections
      new Sentry.Integrations.OnUncaughtException(),
    ],

    // Sample rate for transactions (traces)
    // In production: 10% to avoid high cost
    // In development: 100% to see all traces
    tracesSampleRate: isDevelopment ? 1.0 : parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Sample rate for profiling
    profilesSampleRate: isDevelopment ? 1.0 : parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

    // Attach stack trace to all messages (not just errors)
    attachStacktrace: true,

    // Maximum number of breadcrumbs to store before dropping
    maxBreadcrumbs: 50,

    // Release version (use git commit hash or semantic version)
    release: process.env.RELEASE_VERSION || 'unknown',

    // List of strings matching the errors that should not be sent
    ignoreErrors: [
      // Browser errors
      'top.GLOBALS',
      // Firefox
      'chrome-extension://',
      // Network errors that are expected
      'Network request failed',
      'Failed to fetch',
      // Ignore 401/403 errors (expected auth failures)
      'Unauthorized',
      'Forbidden',
    ],

    // Before sending to Sentry, let's modify the event
    beforeSend: (event, hint) => {
      // Filter out too noisy errors
      if (event.exception) {
        const error = hint.originalException;

        // Don't send 401/403/404 errors (expected client errors)
        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('403') || error.message.includes('404')) {
            return null;
          }
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized for backend');
}

export { Sentry };

/**
 * Capture exception with additional context
 * Use this instead of console.error for critical errors
 */
export function captureException(
  error: Error | unknown,
  context?: {
    userId?: string;
    endpoint?: string;
    method?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): void {
  Sentry.captureException(error, {
    tags: {
      source: 'backend',
      ...context?.tags,
    },
    user: context?.userId
      ? {
          id: context.userId,
        }
      : undefined,
    contexts: {
      http: {
        url: context?.endpoint,
        method: context?.method,
      },
    },
    extra: context?.extra,
  });
}

/**
 * Add breadcrumb for contextual logging
 * Breadcrumbs help understand what happened before an error
 */
export function addBreadcrumb(
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

/**
 * Set user context for error tracking
 * Call this after user authentication
 */
export function setUserContext(userId: string, userEmail?: string, userName?: string): void {
  Sentry.setUser({
    id: userId,
    email: userEmail,
    username: userName,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(name: string, op: string = 'http.server') {
  return Sentry.startTransaction({
    name,
    op,
  });
}