/**
 * Sources Controller (Infrastructure Layer)
 * 
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
 * Controlador simple para descubrimiento automático de fuentes RSS usando IA.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { IGeminiClient } from '../../../domain/services/gemini-client.interface';

// Validación de entrada con Zod (Security: Input Validation)
const discoverSchema = z.object({
  query: z.string().min(2, 'El nombre del medio debe tener al menos 2 caracteres').max(100, 'Máximo 100 caracteres'),
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

      // Llamar a Gemini para descubrir el RSS
      const rssUrl = await this.geminiClient.discoverRssUrl(query);

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
}
