import { describe, it, expect } from 'vitest';
import { GeminiErrorMapper } from './gemini-error-mapper';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

/**
 * ZONA CRÍTICA (CALIDAD.md): 100% coverage
 * Tests para mapeo de errores de Gemini API a códigos HTTP
 * y detección de errores reintentables
 */
describe('GeminiErrorMapper', () => {
  const mapper = new GeminiErrorMapper();

  describe('isRetryable', () => {
    it('should identify rate limit errors as retryable', () => {
      expect(mapper.isRetryable('quota exceeded')).toBe(true);
      expect(mapper.isRetryable('RESOURCE_EXHAUSTED')).toBe(true);
      expect(mapper.isRetryable('429 Too Many Requests')).toBe(true);
      expect(mapper.isRetryable('Error: 429')).toBe(true);
    });

    it('should identify server errors (5xx) as retryable', () => {
      expect(mapper.isRetryable('500 Internal Server Error')).toBe(true);
      expect(mapper.isRetryable('502 Bad Gateway')).toBe(true);
      expect(mapper.isRetryable('503 Service Unavailable')).toBe(true);
      expect(mapper.isRetryable('504 Gateway Timeout')).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      expect(mapper.isRetryable('Error: ECONNRESET')).toBe(true);
      expect(mapper.isRetryable('ETIMEDOUT: connection timed out')).toBe(true);
      expect(mapper.isRetryable('ENOTFOUND: DNS lookup failed')).toBe(true);
    });

    it('should NOT identify client errors as retryable', () => {
      expect(mapper.isRetryable('Invalid API key')).toBe(false);
      expect(mapper.isRetryable('401 Unauthorized')).toBe(false);
      expect(mapper.isRetryable('404 Model not found')).toBe(false);
      expect(mapper.isRetryable('400 Bad Request')).toBe(false);
    });

    it('should NOT identify safety/content errors as retryable', () => {
      expect(mapper.isRetryable('SAFETY: Content blocked')).toBe(false);
      expect(mapper.isRetryable('RECITATION: Content may be copyrighted')).toBe(false);
    });

    it('should handle empty or undefined messages', () => {
      expect(mapper.isRetryable('')).toBe(false);
      expect(mapper.isRetryable('   ')).toBe(false);
    });
  });

  describe('toExternalAPIError', () => {
    it('should map API key errors to 401', () => {
      const error = new Error('Invalid API key provided');
      const result = mapper.toExternalAPIError(error);

      expect(result).toBeInstanceOf(ExternalAPIError);
      expect(result.statusCode).toBe(401);
      expect(result.message).toContain('Invalid API key');
      expect(result.service).toBe('Gemini');
    });

    it('should map "not found" errors to 404', () => {
      const error = new Error('Model gemini-2.5-flash-preview not found');
      const result = mapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(404);
      expect(result.message).toContain('Model not found');
    });

    it('should map quota/rate limit errors to 429', () => {
      const error = new Error('quota exceeded for requests per minute');
      const result = mapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(429);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should map explicit 429 errors to 429', () => {
      const error = new Error('429 Too Many Requests');
      const result = mapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(429);
    });

    it('should map server errors (5xx) to 500', () => {
      const serverErrors = [
        '500 Internal Server Error',
        '502 Bad Gateway',
        '503 Service Unavailable',
        '504 Gateway Timeout',
      ];

      serverErrors.forEach((msg) => {
        const error = new Error(msg);
        const result = mapper.toExternalAPIError(error);
        expect(result.statusCode).toBe(500);
        expect(result.message).toContain('API error');
      });
    });

    it('should map network errors to 500', () => {
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];

      networkErrors.forEach((msg) => {
        const error = new Error(msg);
        const result = mapper.toExternalAPIError(error);
        expect(result.statusCode).toBe(500);
      });
    });

    it('should map unknown errors to 500', () => {
      const error = new Error('Something went completely wrong');
      const result = mapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(500);
      expect(result.message).toContain('API error');
    });

    it('should preserve the original error in the cause', () => {
      const originalError = new Error('Original error message');
      const result = mapper.toExternalAPIError(originalError);

      expect(result.cause).toBe(originalError);
    });

    it('should handle errors with empty messages', () => {
      const error = new Error('');
      const result = mapper.toExternalAPIError(error);

      expect(result).toBeInstanceOf(ExternalAPIError);
      expect(result.statusCode).toBe(500);
    });

    it('should handle errors without message property', () => {
      const error = {} as Error;
      const result = mapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive error matching', () => {
      // Rate limit variations
      expect(mapper.isRetryable('QUOTA EXCEEDED')).toBe(true);
      expect(mapper.isRetryable('Quota Exceeded')).toBe(true);
      expect(mapper.isRetryable('resource_exhausted')).toBe(true);

      const error1 = new Error('INVALID API KEY');
      expect(mapper.toExternalAPIError(error1).statusCode).toBe(401);

      const error2 = new Error('NOT FOUND');
      expect(mapper.toExternalAPIError(error2).statusCode).toBe(404);
    });

    it('should handle combined error messages', () => {
      const error = new Error('Failed after 3 retries: 503 Service Unavailable');
      
      expect(mapper.isRetryable(error.message)).toBe(true);
      expect(mapper.toExternalAPIError(error).statusCode).toBe(500);
    });

    it('should prioritize specific error codes over generic messages', () => {
      // If message contains "quota" AND "429", should map to 429
      const error = new Error('429: quota exceeded');
      const result = mapper.toExternalAPIError(error);
      
      expect(result.statusCode).toBe(429);
    });
  });
});
