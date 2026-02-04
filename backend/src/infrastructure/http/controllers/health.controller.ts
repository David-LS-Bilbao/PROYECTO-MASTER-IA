/**
 * HealthController (Infrastructure/Presentation Layer)
 * Handles health check and readiness probe requests
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export class HealthController {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * GET /health/check
   * Basic health check - returns 200 OK if service is running
   */
  async check(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'verity-news-api',
    });
  }

  /**
   * GET /health/readiness
   * Readiness probe - verifies database connection
   */
  async readiness(_req: Request, res: Response): Promise<void> {
    try {
      // Verify Prisma connection with a simple query
      await this.prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'verity-news-api',
        database: 'connected',
      });
    } catch (error) {
      console.error('Readiness check failed:', error);
      
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'verity-news-api',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
