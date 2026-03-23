/**
 * Sources Controller (Infrastructure Layer)
 *
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9 & 32)
 * Controlador para descubrimiento automático de fuentes RSS usando IA.
 * Sprint 32: Descubrimiento de fuentes locales con caché.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { IGeminiClient } from '../../../domain/services/gemini-client.interface';
import { DiscoverLocalSourcesUseCase } from '../../../application/use-cases/discover-local-sources.usecase';

// Validación de entrada con Zod (Security: Input Validation)
const discoverSchema = z.object({
  query: z.string().min(2, 'El nombre del medio debe tener al menos 2 caracteres').max(100, 'Máximo 100 caracteres'),
});

// Sprint 32: Validación para descubrimiento local
const discoverLocalSchema = z.object({
  location: z.string().min(2, 'La ubicación debe tener al menos 2 caracteres').max(100, 'Máximo 100 caracteres'),
  limit: z.number().min(1).max(20).default(10),
});

export class SourcesController {
  constructor(private readonly geminiClient: IGeminiClient) {}

  /**
   * POST /api/sources/discover
   * Busca automáticamente la URL del RSS de un medio usando Gemini
   */
  async discover(req: Request, res: Response): Promise<void> {
    try {
      // Validar input
      const validationResult = discoverSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validationResult.error.issues,
        });
        return;
      }

      const { query } = validationResult.data;
      const requestId = this.resolveRequestId(req);
      const correlationId = this.resolveCorrelationId(req, requestId);

      // Llamar a Gemini para descubrir el RSS
      const rssUrl = await this.geminiClient.discoverRssUrl(query, {
        requestId,
        correlationId,
        endpoint: `${req.method} ${req.originalUrl}`,
        userId: req.user?.uid,
        entityType: 'source_discovery',
        metadata: {
          queryLength: query.length,
        },
      });

      if (!rssUrl) {
        res.status(404).json({
          success: false,
          error: `No se encontró RSS para "${query}". Intenta con otro nombre o añade la URL manualmente.`,
        });
        return;
      }

      // Éxito
      res.status(200).json({
        success: true,
        data: {
          query,
          rssUrl,
        },
      });
    } catch (error) {
      console.error('❌ Error en discover RSS:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al buscar el RSS',
      });
    }
  }

  /**
   * POST /api/sources/discover-local
   * Descubre fuentes locales/regionales usando Gemini + Caché (Sprint 32)
   */
  async discoverLocal(req: Request, res: Response): Promise<void> {
    try {
      const validation = discoverLocalSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: validation.error.issues,
        });
        return;
      }

      const { location, limit } = validation.data;
      const requestId = this.resolveRequestId(req);
      const correlationId = this.resolveCorrelationId(req, requestId);

      // Execute use case
      const useCase = new DiscoverLocalSourcesUseCase(this.geminiClient);
      const result = await useCase.execute({
        location,
        limit,
        observabilityContext: {
          requestId,
          correlationId,
          endpoint: `${req.method} ${req.originalUrl}`,
          userId: req.user?.uid,
          entityType: 'source_discovery_local',
          metadata: {
            locationLength: location.length,
            limit,
          },
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('❌ Error en discover-local:', error);
      res.status(500).json({
        success: false,
        error: 'Error al descubrir fuentes locales',
      });
    }
  }

  /**
   * GET /api/sources/cache-stats
   * Obtiene estadísticas del caché de descubrimiento local
   */
  async getCacheStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = DiscoverLocalSourcesUseCase.getCacheStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('❌ Error obteniendo cache stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas',
      });
    }
  }

  /**
   * POST /api/sources/clear-cache
   * Limpia el caché de descubrimiento local (admin/debugging)
   */
  async clearCache(_req: Request, res: Response): Promise<void> {
    try {
      DiscoverLocalSourcesUseCase.clearCache();
      res.json({
        success: true,
        message: 'Caché limpiado correctamente',
      });
    } catch (error) {
      console.error('❌ Error limpiando caché:', error);
      res.status(500).json({
        success: false,
        error: 'Error al limpiar caché',
      });
    }
  }

  private resolveRequestId(req: Request): string {
    if (typeof req.id === 'string' && req.id.trim().length > 0) {
      return req.id.trim();
    }

    const headerRequestId = req.header('x-request-id');
    if (headerRequestId && headerRequestId.trim().length > 0) {
      return headerRequestId.trim();
    }

    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private resolveCorrelationId(req: Request, fallbackRequestId: string): string {
    const headerCorrelationId = req.header('x-correlation-id');
    if (headerCorrelationId && headerCorrelationId.trim().length > 0) {
      return headerCorrelationId.trim();
    }

    return fallbackRequestId;
  }
}
