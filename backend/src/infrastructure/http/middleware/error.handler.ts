import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../../domain/errors/domain.error';
import { InfrastructureError, ExternalAPIError } from '../../../domain/errors/infrastructure.error';
import { logger } from '../../logger/logger';

/**
 * Estructura de respuesta de error estandarizada
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

/**
 * Global Error Handler Middleware
 * Captura todos los errores y los convierte en respuestas JSON estructuradas
 *
 * Mapeo de errores:
 * - DomainError → 400/404/409/401/403 (según subclase)
 * - ExternalAPIError → 503 (Service Unavailable)
 * - InfrastructureError → 500 (Internal Server Error)
 * - ZodError → 400 (Bad Request)
 * - Error genérico → 500 (con mensaje sanitizado)
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Evitar enviar respuesta si ya se envió
  if (res.headersSent) {
    return;
  }

  // Generar ID de request para trazabilidad (si no existe)
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  // Mapeo de errores de dominio
  if (error instanceof DomainError) {
    statusCode = error.httpStatusCode;
    errorCode = error.errorCode;
    message = error.message;
    details = error.details;
  }
  // Errores de APIs externas
  else if (error instanceof ExternalAPIError) {
    statusCode = 503; // Service Unavailable
    errorCode = 'EXTERNAL_SERVICE_ERROR';
    message = `External service error: ${error.service}`;
    details = {
      service: error.service,
      statusCode: error.statusCode,
      originalMessage: error.message,
    };
  }
  // Errores de infraestructura genéricos
  else if (error instanceof InfrastructureError) {
    statusCode = 500;
    errorCode = 'INFRASTRUCTURE_ERROR';
    message = 'Internal infrastructure error';
    details = { originalMessage: error.message };
  }
  // Errores de validación Zod
  else if (error.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = { issues: (error as any).issues }; // Zod issues
  }
  // Error genérico (no exponer detalles internos)
  else {
    // Log de error no manejado con stack trace completo
    logger.error({ err: error, requestId, path: req.path, method: req.method }, 'Unhandled error detected');
  }

  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId,
    },
  };

  // Log estructurado con Pino (incluye stack trace automáticamente si NODE_ENV=development)
  logger.error(
    {
      err: error, // Pino serializa automáticamente el error con stack trace
      requestId,
      path: req.path,
      method: req.method,
      statusCode,
      errorCode,
      details,
    },
    `Error ${statusCode}: ${errorCode}`
  );

  res.status(statusCode).json(errorResponse);
}

/**
 * Genera un ID único para el request
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
