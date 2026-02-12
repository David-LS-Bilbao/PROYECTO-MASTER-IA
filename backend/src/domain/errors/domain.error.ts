/**
 * Domain Errors
 * Business logic validation errors with HTTP status codes and structured details
 */

/**
 * Base class for all domain/business logic errors
 * Incluye código HTTP sugerido y detalles estructurados para el Error Handler
 */
export class DomainError extends Error {
  public readonly httpStatusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    httpStatusCode: number = 400,
    errorCode?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    this.httpStatusCode = httpStatusCode;
    this.errorCode = errorCode || this.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, identifier: string) {
    super(
      `${entityName} with identifier ${identifier} not found`,
      404,
      'ENTITY_NOT_FOUND',
      { entityName, identifier }
    );
    this.name = 'EntityNotFoundError';
  }
}

export class DuplicateEntityError extends DomainError {
  constructor(entityName: string, field: string, value: string) {
    super(
      `${entityName} with ${field}=${value} already exists`,
      409,
      'DUPLICATE_ENTITY',
      { entityName, field, value }
    );
    this.name = 'DuplicateEntityError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class QuotaExceededError extends DomainError {
  constructor(message: string = 'Monthly quota exceeded', details?: Record<string, unknown>) {
    super(message, 429, 'QUOTA_EXCEEDED', details);
    this.name = 'QuotaExceededError';
  }
}

export class SecurityError extends DomainError {
  constructor(message: string, errorCode?: string, details?: Record<string, unknown>) {
    super(message, 403, errorCode || 'SECURITY_VIOLATION', details);
    this.name = 'SecurityError';
  }
}

/**
 * LowRelevanceError - Sprint 29 (Graceful Degradation)
 * Thrown when RAG retrieval finds no relevant context for user's question
 * NOT a 4xx/5xx error - this is expected behavior for out-of-domain questions
 *
 * HTTP 200 OK with special flag to trigger frontend fallback to General Chat
 */
export class LowRelevanceError extends DomainError {
  constructor(message: string = 'No encuentro información sobre eso en esta noticia.') {
    // 200 status code - this is not an error, it's a graceful fallback
    super(message, 200, 'LOW_RELEVANCE', { isFallback: true });
    this.name = 'LowRelevanceError';
  }
}
