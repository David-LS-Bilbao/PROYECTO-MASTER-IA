/**
 * Infrastructure Errors
 * External service and technical errors
 */

export class InfrastructureError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'InfrastructureError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends InfrastructureError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'DatabaseError';
  }
}

export class ExternalAPIError extends InfrastructureError {
  constructor(
    public readonly service: string,
    message: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(`${service} API Error: ${message}`, cause);
    this.name = 'ExternalAPIError';
  }
}

export class ConfigurationError extends InfrastructureError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
