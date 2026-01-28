/**
 * Domain Errors
 * Business logic validation errors
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, identifier: string) {
    super(`${entityName} with identifier ${identifier} not found`);
    this.name = 'EntityNotFoundError';
  }
}

export class DuplicateEntityError extends DomainError {
  constructor(entityName: string, field: string, value: string) {
    super(`${entityName} with ${field}=${value} already exists`);
    this.name = 'DuplicateEntityError';
  }
}
