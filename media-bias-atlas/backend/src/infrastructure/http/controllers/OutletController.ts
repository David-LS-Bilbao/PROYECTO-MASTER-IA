import { Request, Response, NextFunction } from 'express';
import { GetOutletByIdUseCase } from '../../../application/useCases/GetOutletByIdUseCase';
import { CreateOutletUseCase } from '../../../application/useCases/CreateOutletUseCase';

export class OutletController {
  constructor(
    private readonly getOutletByIdUseCase: GetOutletByIdUseCase,
    private readonly createOutletUseCase: CreateOutletUseCase
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
}
