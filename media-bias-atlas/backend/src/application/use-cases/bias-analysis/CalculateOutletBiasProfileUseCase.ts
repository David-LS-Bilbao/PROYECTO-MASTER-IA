import { OutletBiasProfile, buildOutletBiasProfile } from '../../../domain/entities/OutletBiasProfile';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';
import { IOutletRepository } from '../../../domain/repositories/IOutletRepository';
import { OutletNotFoundError } from '../../../domain/errors/OutletNotFoundError';

export interface CalculateOutletBiasProfileInput {
  outletId: string;
}

export class CalculateOutletBiasProfileUseCase {
  constructor(
    private readonly articleRepository: IArticleRepository,
    private readonly outletRepository: IOutletRepository
  ) {}

  async execute(input: CalculateOutletBiasProfileInput): Promise<OutletBiasProfile> {
    const outlet = await this.outletRepository.findById(input.outletId);
    if (!outlet) {
      throw new OutletNotFoundError(input.outletId);
    }

    const stats = await this.articleRepository.getOutletBiasStats(input.outletId);
    return buildOutletBiasProfile(input.outletId, stats);
  }
}
