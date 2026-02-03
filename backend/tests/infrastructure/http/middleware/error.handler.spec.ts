/**
 * Error Handler Middleware Tests - ZONA CRÍTICA (Manejo de Errores Global)
 *
 * OBJETIVO: Validar que el middleware de manejo de errores convierte
 * correctamente todos los tipos de errores en respuestas HTTP estandarizadas
 *
 * TEST CASES:
 * - DomainError → Mapeo correcto de códigos HTTP (400/404/409/401/403)
 * - ExternalAPIError → 503 Service Unavailable
 * - InfrastructureError → 500 Internal Server Error
 * - ZodError → 400 Bad Request con issues detallados
 * - Error genérico → 500 con mensaje sanitizado
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Application, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { errorHandler } from '../../../../src/infrastructure/http/middleware/error.handler';
import {
  DomainError,
  EntityNotFoundError,
  ValidationError,
  DuplicateEntityError,
  UnauthorizedError,
  ForbiddenError,
} from '../../../../src/domain/errors/domain.error';
import {
  InfrastructureError,
  ExternalAPIError,
  DatabaseError,
} from '../../../../src/domain/errors/infrastructure.error';

// ============================================================================
// MOCK DE LOGGER
// ============================================================================

// Mock del logger para evitar logs en los tests
vi.mock('../../../../src/infrastructure/logger/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// TEST HELPER - Crear app Express de prueba
// ============================================================================

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  return app;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Error Handler Middleware', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // DOMAIN ERRORS - 400/404/409/401/403
  // ==========================================================================

  describe('Domain Errors - Mapeo correcto de códigos HTTP', () => {
    it('should return 404 for EntityNotFoundError', async () => {
      // ARRANGE: Ruta que lanza EntityNotFoundError
      app.get('/test/not-found', (_req: Request, _res: Response, next: NextFunction) => {
        next(new EntityNotFoundError('Article', 'abc-123'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/not-found');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatchObject({
        code: 'ENTITY_NOT_FOUND',
        message: 'Article with identifier abc-123 not found',
        details: {
          entityName: 'Article',
          identifier: 'abc-123',
        },
      });
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('path', '/test/not-found');
      expect(response.body.error).toHaveProperty('requestId');
    });

    it('should return 400 for ValidationError', async () => {
      // ARRANGE
      app.post('/test/validate', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Invalid email format', { field: 'email', value: 'invalid' }));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/validate');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        details: {
          field: 'email',
          value: 'invalid',
        },
      });
    });

    it('should return 409 for DuplicateEntityError', async () => {
      // ARRANGE
      app.post('/test/duplicate', (_req: Request, _res: Response, next: NextFunction) => {
        next(new DuplicateEntityError('User', 'email', 'test@example.com'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/duplicate');

      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'DUPLICATE_ENTITY',
        message: 'User with email=test@example.com already exists',
        details: {
          entityName: 'User',
          field: 'email',
          value: 'test@example.com',
        },
      });
    });

    it('should return 401 for UnauthorizedError', async () => {
      // ARRANGE
      app.get('/test/unauthorized', (_req: Request, _res: Response, next: NextFunction) => {
        next(new UnauthorizedError('Invalid token'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/unauthorized');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    });

    it('should return 403 for ForbiddenError', async () => {
      // ARRANGE
      app.get('/test/forbidden', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ForbiddenError('Insufficient permissions'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/forbidden');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    });

    it('should return 400 for generic DomainError', async () => {
      // ARRANGE
      app.post('/test/domain', (_req: Request, _res: Response, next: NextFunction) => {
        next(new DomainError('Business rule violation', 400, 'BUSINESS_ERROR'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/domain');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'BUSINESS_ERROR',
        message: 'Business rule violation',
      });
    });
  });

  // ==========================================================================
  // EXTERNAL API ERRORS - 503 Service Unavailable
  // ==========================================================================

  describe('External API Errors - 503 Service Unavailable', () => {
    it('should return 503 for ExternalAPIError', async () => {
      // ARRANGE
      app.get('/test/external', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ExternalAPIError('Gemini', 'Rate limit exceeded', 429));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/external');

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'External service error: Gemini',
        details: {
          service: 'Gemini',
          statusCode: 429,
        },
      });
    });

    it('should include original error message in details', async () => {
      // ARRANGE
      app.post('/test/api-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ExternalAPIError('ChromaDB', 'Connection timeout', 500));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/api-error');

      expect(response.status).toBe(503);
      expect(response.body.error.details).toHaveProperty('originalMessage');
      expect(response.body.error.details.originalMessage).toContain('ChromaDB API Error');
    });
  });

  // ==========================================================================
  // INFRASTRUCTURE ERRORS - 500 Internal Server Error
  // ==========================================================================

  describe('Infrastructure Errors - 500 Internal Server Error', () => {
    it('should return 500 for InfrastructureError', async () => {
      // ARRANGE
      app.get('/test/infra', (_req: Request, _res: Response, next: NextFunction) => {
        next(new InfrastructureError('Database connection failed'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/infra');

      expect(response.status).toBe(500);
      expect(response.body.error).toMatchObject({
        code: 'INFRASTRUCTURE_ERROR',
        message: 'Internal infrastructure error',
        details: {
          originalMessage: 'Database connection failed',
        },
      });
    });

    it('should return 500 for DatabaseError', async () => {
      // ARRANGE
      app.post('/test/db-error', (_req: Request, _res: Response, next: NextFunction) => {
        next(new DatabaseError('Unique constraint violation'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/db-error');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INFRASTRUCTURE_ERROR');
    });
  });

  // ==========================================================================
  // ZOD VALIDATION ERRORS - 400 Bad Request
  // ==========================================================================

  describe('Zod Validation Errors - 400 Bad Request with issues', () => {
    it('should return 400 for ZodError with validation issues', async () => {
      // ARRANGE: Simular un ZodError
      const zodError = {
        name: 'ZodError',
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['email'],
            message: 'Expected string, received number',
          },
          {
            code: 'too_small',
            minimum: 3,
            path: ['password'],
            message: 'String must contain at least 3 character(s)',
          },
        ],
        message: 'Validation failed',
      };

      app.post('/test/zod', (_req: Request, _res: Response, next: NextFunction) => {
        next(zodError as any);
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).post('/test/zod');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          issues: zodError.issues,
        },
      });
    });
  });

  // ==========================================================================
  // GENERIC ERRORS - 500 con mensaje sanitizado
  // ==========================================================================

  describe('Generic Errors - 500 con mensaje sanitizado', () => {
    it('should return 500 for unhandled generic Error', async () => {
      // ARRANGE
      app.get('/test/generic', (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('Something went wrong internally'));
      });

      app.use(errorHandler);

      // ACT & ASSERT
      const response = await request(app).get('/test/generic');

      expect(response.status).toBe(500);
      expect(response.body.error).toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred', // Mensaje sanitizado
      });

      // NO debe exponer el mensaje interno del error
      expect(response.body.error.message).not.toContain('Something went wrong internally');
    });

    it('should NOT expose stack traces in production', async () => {
      // ARRANGE: Simular producción
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test/stack', (_req: Request, _res: Response, next: NextFunction) => {
        const error = new Error('Internal error with stack');
        next(error);
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/stack');

      // ASSERT: No debe incluir stack en la respuesta
      expect(response.body.error).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toContain('at Object');

      // Restaurar env
      process.env.NODE_ENV = originalEnv;
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should include requestId in error response', async () => {
      // ARRANGE
      app.get('/test/request-id', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Test error'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/request-id');

      // ASSERT
      expect(response.body.error).toHaveProperty('requestId');
      expect(response.body.error.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should use X-Request-ID header if provided', async () => {
      // ARRANGE
      const customRequestId = 'custom-req-id-12345';

      app.get('/test/custom-id', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Test error'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app)
        .get('/test/custom-id')
        .set('X-Request-ID', customRequestId);

      // ASSERT
      expect(response.body.error.requestId).toBe(customRequestId);
    });

    it('should include timestamp in ISO format', async () => {
      // ARRANGE
      app.get('/test/timestamp', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Test error'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/timestamp');

      // ASSERT
      expect(response.body.error).toHaveProperty('timestamp');
      expect(() => new Date(response.body.error.timestamp)).not.toThrow();
      expect(response.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include request path in error response', async () => {
      // ARRANGE
      const testPath = '/test/some/nested/path';

      app.get(testPath, (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Test error'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get(testPath);

      // ASSERT
      expect(response.body.error.path).toBe(testPath);
    });

    it('should not send response if headers already sent', async () => {
      // ARRANGE
      app.get('/test/headers-sent', (_req: Request, res: Response, next: NextFunction) => {
        res.status(200).json({ data: 'success' }); // Headers ya enviados
        next(new ValidationError('This should not override the response'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/headers-sent');

      // ASSERT: La respuesta original debe mantenerse
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'success' });
    });
  });

  // ==========================================================================
  // ERROR RESPONSE STRUCTURE VALIDATION
  // ==========================================================================

  describe('Error Response Structure - Validación de esquema', () => {
    it('should always return error response with required fields', async () => {
      // ARRANGE
      app.get('/test/structure', (_req: Request, _res: Response, next: NextFunction) => {
        next(new EntityNotFoundError('Resource', 'test-id'));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/structure');

      // ASSERT: Validar estructura completa
      expect(response.body).toHaveProperty('error');

      const error = response.body.error;
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('path');
      expect(error).toHaveProperty('requestId');

      // Validar tipos
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');
      expect(typeof error.timestamp).toBe('string');
      expect(typeof error.path).toBe('string');
      expect(typeof error.requestId).toBe('string');
    });

    it('should include details field when error provides it', async () => {
      // ARRANGE
      app.get('/test/with-details', (_req: Request, _res: Response, next: NextFunction) => {
        next(new ValidationError('Test validation', { field: 'email', reason: 'invalid format' }));
      });

      app.use(errorHandler);

      // ACT
      const response = await request(app).get('/test/with-details');

      // ASSERT
      expect(response.body.error).toHaveProperty('details');
      expect(response.body.error.details).toEqual({
        field: 'email',
        reason: 'invalid format',
      });
    });
  });
});
