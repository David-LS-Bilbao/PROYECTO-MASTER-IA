import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
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
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    currency: 'EUR',
    inputCostMicrosPer1M: 71_250n,
    outputCostMicrosPer1M: 285_000n,
  },
  {
    provider: 'google',
    model: 'gemini-2.5-flash',
    currency: 'EUR',
    inputCostMicrosPer1M: 71_250n,
    outputCostMicrosPer1M: 285_000n,
  },
];

interface PricingRow {
  id: string;
  currency: string;
  inputCostMicrosPer1M: bigint;
  outputCostMicrosPer1M: bigint;
}

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

    const pricing = await this.prisma.$queryRaw<PricingRow[]>(
      Prisma.sql`
        SELECT
          "id" AS "id",
          "currency" AS "currency",
          "input_cost_micros_per_1m" AS "inputCostMicrosPer1M",
          "output_cost_micros_per_1m" AS "outputCostMicrosPer1M"
        FROM "ai_model_pricing"
        WHERE
          "provider" = ${input.provider}
          AND "model" = ${input.model}
          AND "is_active" = true
          AND "valid_from" <= ${observedAt}
          AND ("valid_to" IS NULL OR "valid_to" >= ${observedAt})
        ORDER BY "valid_from" DESC, "created_at" DESC
        LIMIT 1
      `
    );

    if (!pricing[0]) {
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

    const activePricing = pricing[0];
    const grossMicros =
      promptTokens * activePricing.inputCostMicrosPer1M +
      completionTokens * activePricing.outputCostMicrosPer1M;

    const estimatedCostMicrosEur =
      (grossMicros + MICROS_PER_ONE_EUR / 2n) / MICROS_PER_ONE_EUR;

    return {
      estimatedCostMicrosEur,
      pricingId: activePricing.id,
      currency: activePricing.currency,
    };
  }

  async upsertModelPricing(input: UpsertModelPricingInput): Promise<void> {
    const validFrom = input.validFrom ?? new Date();
    const isActive = input.isActive ?? true;
    const currency = input.currency ?? 'EUR';

    await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "ai_model_pricing"
            SET
              "is_active" = false,
              "valid_to" = ${validFrom},
              "updated_at" = NOW()
            WHERE
              "provider" = ${input.provider}
              AND "model" = ${input.model}
              AND "is_active" = true
              AND "valid_to" IS NULL
          `
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "ai_model_pricing" (
            "id",
            "provider",
            "model",
            "currency",
            "input_cost_micros_per_1m",
            "output_cost_micros_per_1m",
            "is_active",
            "valid_from",
            "valid_to",
            "created_at",
            "updated_at"
          ) VALUES (
            ${randomUUID()},
            ${input.provider},
            ${input.model},
            ${currency},
            ${input.inputCostMicrosPer1M},
            ${input.outputCostMicrosPer1M},
            ${isActive},
            ${validFrom},
            ${input.validTo ?? null},
            NOW(),
            NOW()
          )
        `
      );
    });
  }

  async ensureDefaultPricingCatalog(): Promise<void> {
    for (const defaultPricing of DEFAULT_MODEL_PRICING_CATALOG) {
      const existingActivePricing = await this.prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "ai_model_pricing"
          WHERE
            "provider" = ${defaultPricing.provider}
            AND "model" = ${defaultPricing.model}
            AND "is_active" = true
            AND "valid_to" IS NULL
          ORDER BY "valid_from" DESC
          LIMIT 1
        `
      );

      if (existingActivePricing[0]) {
        continue;
      }

      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "ai_model_pricing" (
            "id",
            "provider",
            "model",
            "currency",
            "input_cost_micros_per_1m",
            "output_cost_micros_per_1m",
            "is_active",
            "valid_from",
            "created_at",
            "updated_at"
          ) VALUES (
            ${randomUUID()},
            ${defaultPricing.provider},
            ${defaultPricing.model},
            ${defaultPricing.currency},
            ${defaultPricing.inputCostMicrosPer1M},
            ${defaultPricing.outputCostMicrosPer1M},
            true,
            NOW(),
            NOW(),
            NOW()
          )
        `
      );
    }
  }

  private normalizeTokenCount(tokens: number | null | undefined): bigint {
    if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) {
      return 0n;
    }

    return BigInt(Math.floor(tokens));
  }
}
