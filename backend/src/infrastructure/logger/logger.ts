/**
 * Logger Central - Pino
 * Configuración centralizada para logging estructurado en toda la aplicación
 *
 * OBSERVABILIDAD (Sprint 13 - Fase B):
 * - Logs en JSON para producción (parseable por herramientas de análisis)
 * - Logs pretty en desarrollo (legibles en consola)
 * - Redaction de datos sensibles (authorization, cookies)
 * - Niveles configurables por NODE_ENV
 *
 * OBSERVABILIDAD (Sprint 15 - Paso 2):
 * - Integración con Sentry: logs → breadcrumbs
 * - Multistream: Console + Sentry (contexto para errores)
 * - Redacción PII ANTES de enviar a Sentry
 */

import pino from 'pino';
import { createSentryStream } from './sentry-stream';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isSentryEnabled = !!process.env.SENTRY_DSN && !isTest;

/**
 * Base logger configuration (shared between streams)
 */
const baseConfig: pino.LoggerOptions = {
  // Nivel de log según entorno
  level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',

  // Redact - Ocultar datos sensibles en logs
  // CRÍTICO: Se aplica ANTES de enviar a cualquier stream (incluido Sentry)
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'apiKey',
      'secret',
    ],
    remove: true, // Eliminar completamente los campos sensibles
  },

  // Serializers personalizados
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Headers sin datos sensibles (ya redactados arriba)
      headers: req.headers,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.headers,
    }),
    err: pino.stdSerializers.err, // Serializer estándar para errores
  },

  // Metadata base para todos los logs
  base: {
    env: process.env.NODE_ENV || 'development',
  },
};

/**
 * Create logger with multistream support
 * Stream 1: Console (pretty in dev, JSON in prod)
 * Stream 2: Sentry (breadcrumbs for error context)
 */
function createLogger() {
  // If Sentry is not enabled, use simple logger
  if (!isSentryEnabled) {
    return pino({
      ...baseConfig,
      // Transport para desarrollo - pino-pretty
      ...(isDevelopment && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
            messageFormat: '{msg} {req.method} {req.url} {res.statusCode}',
          },
        },
      }),
    });
  }

  // Create multistream logger (Console + Sentry)
  const streams: pino.StreamEntry[] = [
    // Stream 1: Console output
    {
      level: baseConfig.level as pino.Level,
      stream: isDevelopment
        ? pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
              messageFormat: '{msg} {req.method} {req.url} {res.statusCode}',
            },
          })
        : process.stdout, // JSON output in production
    },

    // Stream 2: Sentry breadcrumbs
    {
      level: 'debug', // Send all logs >= debug to Sentry
      stream: createSentryStream(),
    },
  ];

  return pino(baseConfig, pino.multistream(streams));
}

/**
 * Exportar logger configurado
 */
export const logger = createLogger();

/**
 * Logger específico para módulos/contextos
 * Permite crear loggers child con contexto adicional
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
