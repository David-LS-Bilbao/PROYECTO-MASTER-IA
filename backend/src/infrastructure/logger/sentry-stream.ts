/**
 * Sentry Stream for Pino Logger
 * Sprint 15 - Paso 2: Integración de Logs con Sentry
 *
 * Converts Pino log events into Sentry breadcrumbs
 * Provides context for errors captured by Sentry
 *
 * FEATURES:
 * - info/warn/debug → Sentry.addBreadcrumb() (context for errors)
 * - error → Breadcrumb only (avoid duplicate captures with error handler)
 * - Respects PII redaction from Pino
 * - Filters noisy logs to avoid breadcrumb overflow
 */

import { Writable } from 'stream';
import { addBreadcrumb } from '../monitoring/sentry';

/**
 * Map Pino log levels to Sentry breadcrumb levels
 */
const LEVEL_MAP: Record<number, 'fatal' | 'error' | 'warning' | 'info' | 'debug'> = {
  10: 'debug',   // trace
  20: 'debug',   // debug
  30: 'info',    // info
  40: 'warning', // warn
  50: 'error',   // error
  60: 'fatal',   // fatal
};

/**
 * Sentry Stream - Writable stream for Pino
 * Converts log entries to Sentry breadcrumbs
 */
export class SentryStream extends Writable {
  constructor() {
    super({ objectMode: true });
  }

  /**
   * Process each log chunk from Pino
   * Called for every log entry
   */
  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    try {
      // Parse log entry (Pino emits objects when using multistream)
      const log = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;

      // Extract log metadata
      const level = log.level;
      const message = log.msg || log.message || 'Log without message';
      // const timestamp = log.time; // Not currently used

      // Map Pino level (number) to Sentry level (string)
      const sentryLevel = LEVEL_MAP[level] || 'info';

      // Filter noisy logs (optional - avoid breadcrumb overflow)
      if (this.shouldSkipLog(log)) {
        callback();
        return;
      }

      // Extract relevant context (remove noise)
      const data = this.extractContext(log);

      // Add breadcrumb to Sentry
      addBreadcrumb(message, sentryLevel, data);

      callback();
    } catch (error) {
      // Don't crash the logger if Sentry fails
      console.error('[SentryStream] Failed to process log:', error);
      callback();
    }
  }

  /**
   * Decide if log should be skipped
   * Filter out too noisy logs to avoid breadcrumb overflow
   */
  private shouldSkipLog(log: any): boolean {
    // Skip health check logs (too noisy)
    if (log.req?.url?.includes('/health')) {
      return true;
    }

    // Skip trace level in production (too verbose)
    if (log.level === 10 && process.env.NODE_ENV === 'production') {
      return true;
    }

    return false;
  }

  /**
   * Extract relevant context from log entry
   * Remove noise and Pino metadata
   */
  private extractContext(log: any): Record<string, any> {
    const context: Record<string, any> = {};

    // HTTP request context
    if (log.req) {
      context.method = log.req.method;
      context.url = log.req.url;
      context.statusCode = log.res?.statusCode;
      context.remoteAddress = log.req.remoteAddress;
    }

    // Error context
    if (log.err) {
      context.error = {
        message: log.err.message,
        stack: log.err.stack,
        type: log.err.type,
      };
    }

    // Module/component context
    if (log.module) {
      context.module = log.module;
    }

    // User context (if available)
    if (log.userId) {
      context.userId = log.userId;
    }

    // Custom fields (anything not standard Pino metadata)
    const standardFields = [
      'level', 'time', 'pid', 'hostname', 'msg', 'message',
      'req', 'res', 'err', 'module', 'env', 'v'
    ];

    Object.keys(log).forEach((key) => {
      if (!standardFields.includes(key)) {
        context[key] = log[key];
      }
    });

    return context;
  }
}

/**
 * Create Sentry stream for Pino
 * Usage: pinoLogger.stream = createSentryStream()
 */
export function createSentryStream(): SentryStream {
  return new SentryStream();
}
