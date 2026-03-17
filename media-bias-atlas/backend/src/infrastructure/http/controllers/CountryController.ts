import { Request, Response, NextFunction } from 'express';
import { ListCountriesUseCase } from '../../../application/useCases/ListCountriesUseCase';
import { ListOutletsByCountryUseCase } from '../../../application/useCases/ListOutletsByCountryUseCase';

export class CountryController {
  constructor(
    private readonly listCountriesUseCase: ListCountriesUseCase,
    private readonly listOutletsByCountryUseCase: ListOutletsByCountryUseCase
  ) {}

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const countries = await this.listCountriesUseCase.execute();
      res.status(200).json(countries);
    } catch (error) {
      next(error);
    }
  }

  async listOutlets(req: Request, res: Response, next: NextFunction) {
    try {
      const dbCode = req.params.code;
      const outlets = await this.listOutletsByCountryUseCase.execute(dbCode);
      res.status(200).json(outlets);
    } catch (error) {
      next(error);
    }
  }
}
