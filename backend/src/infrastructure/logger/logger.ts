/**
 * Logger Central - Pino
 * Configuración centralizada para logging estructurado en toda la aplicación
 *
 * OBSERVABILIDAD (Sprint 13 - Fase B):
 * - Logs en JSON para producción (parseable por herramientas de análisis)
 * - Logs pretty en desarrollo (legibles en consola)
 * - Redaction de datos sensibles (authorization, cookies)
 * - Niveles configurables por NODE_ENV
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Configuración de Pino Logger
 */
export const logger = pino({
  // Nivel de log según entorno
  level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',

  // Redact - Ocultar datos sensibles en logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
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

  // Metadata base para todos los logs
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Logger específico para módulos/contextos
 * Permite crear loggers child con contexto adicional
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
