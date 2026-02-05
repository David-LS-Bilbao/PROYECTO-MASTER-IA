/**
 * Zod Schemas for User Profile Data (BLOQUEANTE #3)
 *
 * Valida y sanea datos de usuario provenientes de Firebase/PostgreSQL
 * para prevenir inyecciones y type confusion attacks.
 *
 * === SECURITY (Sprint 14 - Bloqueante #3) ===
 * - Elimina tipos `any` en auth middleware
 * - Valida estructura de preferences y usageStats
 * - Previene XSS, SQL Injection, Type Confusion
 * - Safe defaults cuando los datos están corruptos
 */

import { z } from 'zod';

/**
 * Schema para User Preferences
 *
 * Define estructura válida para preferencias de usuario.
 * Si los datos están corruptos, se usan valores por defecto seguros.
 */
export const UserPreferencesSchema = z.object({
  // Tema de la interfaz: solo 'light' o 'dark'
  theme: z.enum(['light', 'dark']).default('light'),

  // Categorías de interés: array de strings no vacíos
  categories: z.array(z.string().min(1)).default([]),

  // Idioma preferido: códigos ISO de 2 letras
  language: z.enum(['es', 'en', 'fr', 'de', 'it']).default('es').optional(),

  // Notificaciones habilitadas
  notificationsEnabled: z.boolean().default(true).optional(),

  // Modo compacto de visualización
  compactMode: z.boolean().default(false).optional(),
}).strict(); // Rechaza campos adicionales no definidos

/**
 * Schema para User Usage Stats
 *
 * Define estructura válida para estadísticas de uso de IA.
 * Campos deben ser números válidos (no NaN, no Infinity).
 */
export const UserUsageStatsSchema = z.object({
  // Número de llamadas a la API de IA
  apiCalls: z.number().int().nonnegative().default(0).optional(),

  // Tokens consumidos (entrada + salida)
  tokensUsed: z.number().int().nonnegative().default(0).optional(),

  // Coste acumulado en EUR
  cost: z.number().nonnegative().finite().default(0).optional(),

  // Timestamp de última actualización (ISO 8601)
  lastUpdated: z.string().datetime().optional(),

  // Límite de cuota mensual (para plan QUOTA)
  monthlyQuota: z.number().int().positive().optional(),

  // Uso del mes actual
  currentMonthUsage: z.number().int().nonnegative().default(0).optional(),
}).strict();

/**
 * Safe parse con fallback a defaults
 *
 * Si la validación falla, retorna un objeto con valores por defecto
 * seguros en lugar de lanzar error (para no bloquear login).
 */
export function safeParseUserPreferences(data: unknown): z.infer<typeof UserPreferencesSchema> {
  const result = UserPreferencesSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // Log del error de validación (para debugging, no para producción)
  console.warn('[Auth] Invalid user preferences, using defaults:', result.error.format());

  // Retornar defaults seguros
  return {
    theme: 'light',
    categories: [],
  };
}

/**
 * Safe parse para usage stats con fallback
 */
export function safeParseUserUsageStats(data: unknown): z.infer<typeof UserUsageStatsSchema> {
  const result = UserUsageStatsSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // Log del error de validación
  console.warn('[Auth] Invalid user usage stats, using defaults:', result.error.format());

  // Retornar defaults seguros
  return {
    apiCalls: 0,
    tokensUsed: 0,
    cost: 0,
    currentMonthUsage: 0,
  };
}

/**
 * Type exports para uso en TypeScript
 */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserUsageStats = z.infer<typeof UserUsageStatsSchema>;
