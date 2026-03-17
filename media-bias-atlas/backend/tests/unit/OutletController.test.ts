import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { OutletController } from '../../src/infrastructure/http/controllers/OutletController';
import { GetOutletByIdUseCase } from '../../src/application/useCases/GetOutletByIdUseCase';
import { CreateOutletUseCase } from '../../src/application/useCases/CreateOutletUseCase';
import { CalculateOutletBiasProfileUseCase } from '../../src/application/use-cases/bias-analysis/CalculateOutletBiasProfileUseCase';
import { OutletNotFoundError } from '../../src/domain/errors/OutletNotFoundError';
import { OutletBiasStatus } from '../../src/domain/entities/OutletBiasProfile';
import { IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';

describe('OutletController', () => {
  let getOutletByIdUseCase: import('vitest').Mocked<GetOutletByIdUseCase>;
  let createOutletUseCase: import('vitest').Mocked<CreateOutletUseCase>;
  let calculateUseCase: import('vitest').Mocked<CalculateOutletBiasProfileUseCase>;
  let controller: OutletController;
  
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    getOutletByIdUseCase = { execute: vi.fn() } as any;
    createOutletUseCase = { execute: vi.fn() } as any;
    calculateUseCase = { execute: vi.fn() } as any;
    
    controller = new OutletController(getOutletByIdUseCase, createOutletUseCase, calculateUseCase);
    
    req = { params: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  describe('getBiasProfile', () => {
    it('debe devolver un DTO limpio con HTTP 200 en caso de exito', async () => {
      req.params = { outletId: 'outlet-123' };
      
      const mockProfile = {
        outletId: 'outlet-123',
        status: OutletBiasStatus.ANALYZED,
        totalPoliticalArticles: 20,
        totalCompletedAnalyses: 15,
        dominantLabel: IdeologyLabel.CENTER,
        distribution: {
          [IdeologyLabel.LEFT]: 0,
          [IdeologyLabel.CENTER_LEFT]: 2,
          [IdeologyLabel.CENTER]: 10,
          [IdeologyLabel.CENTER_RIGHT]: 3,
          [IdeologyLabel.RIGHT]: 0,
          [IdeologyLabel.UNCLEAR]: 0
        }
      };

      calculateUseCase.execute.mockResolvedValue(mockProfile);

      await controller.getBiasProfile(req as Request, res as Response, next);

      expect(calculateUseCase.execute).toHaveBeenCalledWith({ outletId: 'outlet-123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        outletId: 'outlet-123',
        status: OutletBiasStatus.ANALYZED,
        totalPoliticalArticles: 20,
        totalCompletedAnalyses: 15,
        minimumSampleRequired: 5, // DTO hardcoded specific requirement
        dominantLabel: IdeologyLabel.CENTER,
        distribution: mockProfile.distribution
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('debe devolver HTTP 404 puro cuando el medio no existe en base a OutletNotFoundError', async () => {
      req.params = { outletId: 'invalid-id' };
      
      const error = new OutletNotFoundError('invalid-id');
      calculateUseCase.execute.mockRejectedValue(error);

      await controller.getBiasProfile(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Medio con ID invalid-id no encontrado.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('debe redirigir otros errores no esperados al middleware global mediante next(error)', async () => {
      req.params = { outletId: 'outlet-123' };
      
      const genericError = new Error('Database down');
      calculateUseCase.execute.mockRejectedValue(genericError);

      await controller.getBiasProfile(req as Request, res as Response, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(genericError);
    });
  });
});
