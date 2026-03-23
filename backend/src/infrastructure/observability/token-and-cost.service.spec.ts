import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TokenAndCostService } from './token-and-cost.service';

describe('TokenAndCostService', () => {
  const prismaMock = {
    aiModelPricing: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;

  let service: TokenAndCostService;

  beforeEach(() => {
    prismaMock.aiModelPricing.findFirst.mockReset();
    prismaMock.aiModelPricing.create.mockReset();
    prismaMock.aiModelPricing.updateMany.mockReset();
    prismaMock.$transaction.mockReset();
    service = new TokenAndCostService(prismaMock);
  });

  it('calculates estimated cost in micros EUR using active pricing', async () => {
    prismaMock.aiModelPricing.findFirst.mockResolvedValue({
      id: 'pricing-1',
      currency: 'EUR',
      inputCostMicrosPer1M: 71_250n,
      outputCostMicrosPer1M: 285_000n,
    });

    const result = await service.estimateCostMicrosEur({
      provider: 'google',
      model: 'gemini-2.5-flash',
      promptTokens: 1_000,
      completionTokens: 500,
    });

    expect(result).toEqual({
      estimatedCostMicrosEur: 214n,
      pricingId: 'pricing-1',
      currency: 'EUR',
    });
  });

  it('returns null cost when pricing is missing', async () => {
    prismaMock.aiModelPricing.findFirst.mockResolvedValue(null);

    const result = await service.estimateCostMicrosEur({
      provider: 'unknown',
      model: 'model-x',
      promptTokens: 100,
      completionTokens: 100,
    });

    expect(result).toEqual({
      estimatedCostMicrosEur: null,
      pricingId: null,
      currency: null,
    });
  });

  it('seeds default pricing when no active catalog exists', async () => {
    prismaMock.aiModelPricing.findFirst.mockResolvedValue(null);
    prismaMock.aiModelPricing.create.mockResolvedValue({});

    await service.ensureDefaultPricingCatalog();

    expect(prismaMock.aiModelPricing.create).toHaveBeenCalledTimes(2);
  });
});
