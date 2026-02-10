/**
 * Constants Helper Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCostEUR,
  getDailyAnalysisLimit,
  getMonthlyChatLimit,
  getUserPlanConfig,
  GEMINI_PRICING,
  CURRENCY_RATES,
} from '../../src/config/constants';

describe('constants helpers', () => {
  it('calculateCostEUR calcula coste correctamente', () => {
    const cost = calculateCostEUR(1_000_000, 1_000_000);
    const expected = (GEMINI_PRICING.INPUT_COST_PER_1M_TOKENS + GEMINI_PRICING.OUTPUT_COST_PER_1M_TOKENS)
      * CURRENCY_RATES.EUR_USD_RATE;

    expect(cost).toBeCloseTo(expected, 6);
  });

  it('getUserPlanConfig retorna plan por defecto y plan PRO', () => {
    const defaultPlan = getUserPlanConfig();
    const proPlan = getUserPlanConfig('PRO');

    expect(defaultPlan.name).toBe('Free');
    expect(proPlan.name).toBe('Professional');
  });

  it('getDailyAnalysisLimit retorna limite correcto', () => {
    expect(getDailyAnalysisLimit('FREE')).toBe(50);
    expect(getDailyAnalysisLimit('ENTERPRISE')).toBe(10000);
  });

  it('getMonthlyChatLimit retorna limite correcto', () => {
    expect(getMonthlyChatLimit('FREE')).toBe(20);
    expect(getMonthlyChatLimit('PRO')).toBe(200);
  });
});
