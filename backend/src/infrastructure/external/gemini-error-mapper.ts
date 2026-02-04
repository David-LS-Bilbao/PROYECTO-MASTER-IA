import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

/**
 * GeminiErrorMapper
 * 
 * Responsable de mapear errores de Gemini API a ExternalAPIError
 * con códigos HTTP apropiados y determinar si un error es reintenTable.
 * 
 * SOLID: Single Responsibility - Solo manejo de errores
 * Extraído de GeminiClient para mejorar testabilidad y reutilización
 */
export class GeminiErrorMapper {
  /**
   * Determina si un error es reintenTable basándose en el mensaje
   * 
   * Errores reintentables:
   * - Rate limit (429, quota, RESOURCE_EXHAUSTED)
   * - Server errors (500, 502, 503, 504)
   * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
   * 
   * Errores NO reintentables:
   * - Client errors (401, 404, 400)
   * - Safety/Content policy violations
   * 
   * @param errorMessage - Mensaje de error a evaluar
   * @returns true si el error es reintenTable
   */
  static isRetryable(errorMessage: string): boolean {
    if (!errorMessage || errorMessage.trim().length === 0) {
      return false;
    }

    const msg = errorMessage.toLowerCase();

    return (
      // Rate Limit (429)
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('429') ||
      msg.includes('too many requests') ||
      // Server Errors (5xx)
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('internal server error') ||
      msg.includes('service unavailable') ||
      msg.includes('gateway timeout') ||
      // Network errors
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound')
    );
  }

  /**
   * Convierte un Error genérico en ExternalAPIError con código HTTP apropiado
   * 
   * Mapeo de errores:
   * - 401: API key inválida
   * - 404: Modelo no encontrado
   * - 429: Rate limit excedido (quota)
   * - 500: Errores de servidor, red, o desconocidos
   * 
   * @param error - Error original de Gemini API
   * @returns ExternalAPIError con código HTTP y mensaje apropiado
   */
  static toExternalAPIError(error: unknown): ExternalAPIError {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorMessage = err.message || '';
    const msg = errorMessage.toLowerCase();

    // 401 - Unauthorized (API key inválida)
    if (msg.includes('api key') || msg.includes('401')) {
      return new ExternalAPIError('Gemini', 'Invalid API key', 401, err);
    }

    // 404 - Not Found (Modelo no encontrado)
    if (msg.includes('404') || msg.includes('not found')) {
      return new ExternalAPIError('Gemini', `Model not found: ${errorMessage}`, 404, err);
    }

    // 429 - Rate Limit
    if (this.isRetryable(errorMessage) && (msg.includes('429') || msg.includes('quota'))) {
      return new ExternalAPIError('Gemini', 'Rate limit exceeded after retries', 429, err);
    }

    // 500 - Generic server error (5xx, network, unknown)
    return new ExternalAPIError('Gemini', `API error: ${errorMessage}`, 500, err);
  }
}
