import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../logger/logger';

const logger = createModuleLogger('TokenAndCostService');

const MICROS_PER_ONE_EUR = 1_000_000n;

const DEFAULT_MODEL_PRICING_CATALOG: Array<{
  provider: string;
  model: string;
  currency: string;
  inputCostMicrosPer1M: bigint;
  outputCostMicrosPer1M: bigint;
}> = [
  {
    provider: 'google',
    model: 'gemini-2.5-flash',
    currency: 'EUR',
    inputCostMicrosPer1M: 71_250n,
    outputCostMicrosPer1M: 285_000n,
  },
  {
    provider: 'google',
    model: 'text-embedding-004',
    currency: 'EUR',
    inputCostMicrosPer1M: 71_250n,
    outputCostMicrosPer1M: 0n,
  },
];

export interface CostEstimateInput {
  provider: string;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  observedAt?: Date;
}

export interface CostEstimateResult {
  estimatedCostMicrosEur: bigint | null;
  pricingId: string | null;
  currency: string | null;
}

export interface UpsertModelPricingInput {
  provider: string;
  model: string;
  currency?: string;
  inputCostMicrosPer1M: bigint;
  outputCostMicrosPer1M: bigint;
  validFrom?: Date;
  validTo?: Date | null;
  isActive?: boolean;
}

export class TokenAndCostService {
  constructor(private readonly prisma: PrismaClient) {}

  async estimateCostMicrosEur(input: CostEstimateInput): Promise<CostEstimateResult> {
    const promptTokens = this.normalizeTokenCount(input.promptTokens);
    const completionTokens = this.normalizeTokenCount(input.completionTokens);
    const observedAt = input.observedAt ?? new Date();

    if (promptTokens === 0n && completionTokens === 0n) {
      return {
        estimatedCostMicrosEur: 0n,
        pricingId: null,
        currency: 'EUR',
      };
    }

    const pricing = await this.prisma.aiModelPricing.findFirst({
      where: {
        provider: input.provider,
        model: input.model,
        isActive: true,
        validFrom: { lte: observedAt },
        OR: [{ validTo: null }, { validTo: { gte: observedAt } }],
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!pricing) {
      logger.warn(
        {
          provider: input.provider,
          model: input.model,
        },
        'No active pricing found for model. Returning null cost.'
      );
      return {
        estimatedCostMicrosEur: null,
        pricingId: null,
        currency: null,
      };
    }

    const grossMicros =
      promptTokens * pricing.inputCostMicrosPer1M +
      completionTokens * pricing.outputCostMicrosPer1M;

    const estimatedCostMicrosEur =
      (grossMicros + MICROS_PER_ONE_EUR / 2n) / MICROS_PER_ONE_EUR;

    return {
      estimatedCostMicrosEur,
      pricingId: pricing.id,
      currency: pricing.currency,
    };
  }

  async upsertModelPricing(input: UpsertModelPricingInput): Promise<void> {
    const validFrom = input.validFrom ?? new Date();
    const isActive = input.isActive ?? true;
    const currency = input.currency ?? 'EUR';

    await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.aiModelPricing.updateMany({
          where: {
            provider: input.provider,
            model: input.model,
            isActive: true,
            validTo: null,
          },
          data: {
            isActive: false,
            validTo: validFrom,
          },
        });
      }

      await tx.aiModelPricing.create({
        data: {
          provider: input.provider,
          model: input.model,
          currency,
          inputCostMicrosPer1M: input.inputCostMicrosPer1M,
          outputCostMicrosPer1M: input.outputCostMicrosPer1M,
          validFrom,
          validTo: input.validTo ?? null,
          isActive,
        },
      });
    });
  }

  async ensureDefaultPricingCatalog(): Promise<void> {
    for (const defaultPricing of DEFAULT_MODEL_PRICING_CATALOG) {
      const existingActivePricing = await this.prisma.aiModelPricing.findFirst({
        where: {
          provider: defaultPricing.provider,
          model: defaultPricing.model,
          isActive: true,
          validTo: null,
        },
        orderBy: [{ validFrom: 'desc' }],
      });

      if (existingActivePricing) {
        continue;
      }

      await this.prisma.aiModelPricing.create({
        data: {
          provider: defaultPricing.provider,
          model: defaultPricing.model,
          currency: defaultPricing.currency,
          inputCostMicrosPer1M: defaultPricing.inputCostMicrosPer1M,
          outputCostMicrosPer1M: defaultPricing.outputCostMicrosPer1M,
          isActive: true,
          validFrom: new Date(),
        },
      });
    }
  }

  private normalizeTokenCount(tokens: number | null | undefined): bigint {
    if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) {
      return 0n;
    }

    return BigInt(Math.floor(tokens));
  }
}
