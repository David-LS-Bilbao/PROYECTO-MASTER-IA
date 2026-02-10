/**
 * IngestController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { IngestController } from '../../../../src/infrastructure/http/controllers/ingest.controller';
import { ValidationError } from '../../../../src/domain/errors/domain.error';
import {
  ExternalAPIError,
  DatabaseError,
  InfrastructureError,
} from '../../../../src/domain/errors/infrastructure.error';

// ============================================================================
// HELPERS
// ============================================================================

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('IngestController', () => {
  let controller: IngestController;
  let ingestNewsUseCase: { execute: ReturnType<typeof vi.fn>; ingestAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    ingestNewsUseCase = {
      execute: vi.fn(),
      ingestAll: vi.fn(),
    };
    controller = new IngestController(ingestNewsUseCase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ingestNews', () => {
    it('200 si ingesta correctamente', async () => {
      const { res, statusMock, jsonMock } = createRes();
      const req = {
        body: { category: 'general', language: 'es', pageSize: 5 },
      } as Request;

      ingestNewsUseCase.execute.mockResolvedValueOnce({
        success: true,
        totalFetched: 5,
        newArticles: 2,
        duplicates: 3,
        errors: 0,
        source: 'newsapi',
        timestamp: new Date('2026-02-01T10:00:00Z'),
      });

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ newArticles: 2 }),
        })
      );
    });

    it('400 si falla validacion Zod', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'invalid' },
      } as Request;

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('400 si ValidationError del dominio', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'general' },
      } as Request;

      ingestNewsUseCase.execute.mockRejectedValueOnce(new ValidationError('Invalid input'));

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('statusCode del ExternalAPIError', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'general' },
      } as Request;

      ingestNewsUseCase.execute.mockRejectedValueOnce(new ExternalAPIError('NewsAPI', 'Down', 503));

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
    });

    it('500 si DatabaseError', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'general' },
      } as Request;

      ingestNewsUseCase.execute.mockRejectedValueOnce(new DatabaseError('DB error'));

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('500 si InfrastructureError', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'general' },
      } as Request;

      ingestNewsUseCase.execute.mockRejectedValueOnce(new InfrastructureError('Infra error'));

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('500 si error desconocido', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: { category: 'general' },
      } as Request;

      ingestNewsUseCase.execute.mockRejectedValueOnce(new Error('Unknown'));

      await controller.ingestNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getIngestionStatus', () => {
    it('200 con respuesta simple', async () => {
      const { res, statusMock } = createRes();

      await controller.getIngestionStatus({} as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('ingestAllNews', () => {
    it('200 con resumen global', async () => {
      const { res, statusMock, jsonMock } = createRes();

      ingestNewsUseCase.ingestAll.mockResolvedValueOnce({
        processed: 2,
        errors: 1,
        results: {
          general: { newArticles: 1, duplicates: 0 },
          economia: { newArticles: 2, duplicates: 1 },
        },
      });

      await controller.ingestAllNews({} as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalNewArticles: 3,
            totalDuplicates: 1,
          }),
        })
      );
    });
  });
});
