/**
 * Request Logger Middleware - Pino HTTP
 * Logging automático de todas las peticiones HTTP con correlación de requestId
 *
 * OBSERVABILIDAD (Sprint 13 - Fase B):
 * - Log automático de request/response
 * - Generación de requestId para trazabilidad
 * - Métricas de duración de peticiones
 * - Serialización estructurada de errores HTTP
 */

import pinoHttp from 'pino-http';
import { logger } from '../../logger/logger';
import { Request, Response } from 'express';

/**
 * Genera un ID único para cada request (si no viene en headers)
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Middleware de logging HTTP con Pino
 * 
 * Características:
 * - Genera/extrae requestId de headers (X-Request-ID)
 * - Log automático en request y response
 * - Incluye duración de la petición (responseTime)
 * - Correlaciona logs con requestId
 */
export const requestLogger = pinoHttp({
  // Inyectar instancia del logger principal
  logger,

  // Generar requestId si no existe
  genReqId: (req: Request) => {
    return (req.headers['x-request-id'] as string) || generateRequestId();
  },

  // Propiedades personalizadas para cada log HTTP
  customProps: (req: Request) => ({
    requestId: req.id, // Correlación de logs
  }),

  // Serializers personalizados para request/response
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.raw.url, // URL original sin query params parseados
      query: req.query,
      params: req.params,
      remoteAddress: req.raw.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      // Incluir headers de respuesta si es necesario
    }),
  },

  // Personalizar mensajes de log
  customLogLevel: (_req: Request, res: Response, err?: Error) => {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    if (res.statusCode >= 300) {
      return 'info';
    }
    return 'info';
  },

  // Personalizar mensaje de log de respuesta
  customSuccessMessage: (req: Request, res: Response) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },

  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
});
