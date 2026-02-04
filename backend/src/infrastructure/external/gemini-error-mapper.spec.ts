import { describe, it, expect } from 'vitest';
import { GeminiErrorMapper } from './gemini-error-mapper';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

/**
 * ZONA CRÍTICA (CALIDAD.md): 100% coverage
 * Tests para mapeo de errores de Gemini API a códigos HTTP
 * y detección de errores reintentables
 */
describe('GeminiErrorMapper', () => {
  describe('isRetryable', () => {
    it('should identify rate limit errors as retryable', () => {
      expect(GeminiErrorMapper.isRetryable('quota exceeded')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('RESOURCE_EXHAUSTED')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('429 Too Many Requests')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('Error: 429')).toBe(true);
    });

    it('should identify server errors (5xx) as retryable', () => {
      expect(GeminiErrorMapper.isRetryable('500 Internal Server Error')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('502 Bad Gateway')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('503 Service Unavailable')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('504 Gateway Timeout')).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      expect(GeminiErrorMapper.isRetryable('Error: ECONNRESET')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('ETIMEDOUT: connection timed out')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('ENOTFOUND: DNS lookup failed')).toBe(true);
    });

    it('should NOT identify client errors as retryable', () => {
      expect(GeminiErrorMapper.isRetryable('Invalid API key')).toBe(false);
      expect(GeminiErrorMapper.isRetryable('401 Unauthorized')).toBe(false);
      expect(GeminiErrorMapper.isRetryable('404 Model not found')).toBe(false);
      expect(GeminiErrorMapper.isRetryable('400 Bad Request')).toBe(false);
    });

    it('should NOT identify safety/content errors as retryable', () => {
      expect(GeminiErrorMapper.isRetryable('SAFETY: Content blocked')).toBe(false);
      expect(GeminiErrorMapper.isRetryable('RECITATION: Content may be copyrighted')).toBe(false);
    });

    it('should handle empty or undefined messages', () => {
      expect(GeminiErrorMapper.isRetryable('')).toBe(false);
      expect(GeminiErrorMapper.isRetryable('   ')).toBe(false);
    });
  });

  describe('toExternalAPIError', () => {
    it('should map API key errors to 401', () => {
      const error = new Error('Invalid API key provided');
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result).toBeInstanceOf(ExternalAPIError);
      expect(result.statusCode).toBe(401);
      expect(result.message).toContain('Invalid API key');
      expect(result.service).toBe('Gemini');
    });

    it('should map "not found" errors to 404', () => {
      const error = new Error('Model gemini-2.5-flash-preview not found');
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(404);
      expect(result.message).toContain('Model not found');
    });

    it('should map quota/rate limit errors to 429', () => {
      const error = new Error('quota exceeded for requests per minute');
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(429);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should map explicit 429 errors to 429', () => {
      const error = new Error('429 Too Many Requests');
      const result = GeminiErrorMapper.toExternalAPIError(error);

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
        const result = GeminiErrorMapper.toExternalAPIError(error);
        expect(result.statusCode).toBe(500);
        expect(result.message).toContain('API error');
      });
    });

    it('should map network errors to 500', () => {
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];

      networkErrors.forEach((msg) => {
        const error = new Error(msg);
        const result = GeminiErrorMapper.toExternalAPIError(error);
        expect(result.statusCode).toBe(500);
      });
    });

    it('should map unknown errors to 500', () => {
      const error = new Error('Something went completely wrong');
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(500);
      expect(result.message).toContain('API error');
    });

    it('should preserve the original error in the cause', () => {
      const originalError = new Error('Original error message');
      const result = GeminiErrorMapper.toExternalAPIError(originalError);

      expect(result.cause).toBe(originalError);
    });

    it('should handle errors with empty messages', () => {
      const error = new Error('');
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result).toBeInstanceOf(ExternalAPIError);
      expect(result.statusCode).toBe(500);
    });

    it('should handle errors without message property', () => {
      const error = {} as Error;
      const result = GeminiErrorMapper.toExternalAPIError(error);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive error matching', () => {
      // Rate limit variations
      expect(GeminiErrorMapper.isRetryable('QUOTA EXCEEDED')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('Quota Exceeded')).toBe(true);
      expect(GeminiErrorMapper.isRetryable('resource_exhausted')).toBe(true);

      const error1 = new Error('INVALID API KEY');
      expect(GeminiErrorMapper.toExternalAPIError(error1).statusCode).toBe(401);

      const error2 = new Error('NOT FOUND');
      expect(GeminiErrorMapper.toExternalAPIError(error2).statusCode).toBe(404);
    });

    it('should handle combined error messages', () => {
      const error = new Error('Failed after 3 retries: 503 Service Unavailable');
      
      expect(GeminiErrorMapper.isRetryable(error.message)).toBe(true);
      expect(GeminiErrorMapper.toExternalAPIError(error).statusCode).toBe(500);
    });

    it('should prioritize specific error codes over generic messages', () => {
      // If message contains "quota" AND "429", should map to 429
      const error = new Error('429: quota exceeded');
      const result = GeminiErrorMapper.toExternalAPIError(error);
      
      expect(result.statusCode).toBe(429);
    });
  });
});
