import { Request, Response, NextFunction } from 'express';
import { GetOutletByIdUseCase } from '../../../application/useCases/GetOutletByIdUseCase';
import { CreateOutletUseCase } from '../../../application/useCases/CreateOutletUseCase';
import { CalculateOutletBiasProfileUseCase } from '../../../application/use-cases/bias-analysis/CalculateOutletBiasProfileUseCase';
import { OutletNotFoundError } from '../../../domain/errors/OutletNotFoundError';

export class OutletController {
  constructor(
    private readonly getOutletByIdUseCase: GetOutletByIdUseCase,
    private readonly createOutletUseCase: CreateOutletUseCase,
    private readonly calculateOutletBiasProfileUseCase: CalculateOutletBiasProfileUseCase
  ) {}

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const outlet = await this.getOutletByIdUseCase.execute(id);
      res.status(200).json(outlet);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const outlet = await this.createOutletUseCase.execute(req.body);
      res.status(201).json(outlet);
    } catch (error) {
      next(error);
    }
  }

  async getBiasProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { outletId } = req.params;
      
      const profile = await this.calculateOutletBiasProfileUseCase.execute({ outletId });

      // Clean DTO mapping
      const dto = {
        outletId: profile.outletId,
        status: profile.status,
        totalPoliticalArticles: profile.totalPoliticalArticles,
        totalCompletedAnalyses: profile.totalCompletedAnalyses,
        minimumSampleRequired: 5,
        dominantLabel: profile.dominantLabel,
        distribution: profile.distribution,
      };

      res.status(200).json(dto);
    } catch (error) {
      if (error instanceof OutletNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}
