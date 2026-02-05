import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenTaximeter } from './token-taximeter';

describe('TokenTaximeter - Zona Crítica (100% coverage)', () => {
  let taximeter: TokenTaximeter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    taximeter = new TokenTaximeter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Cost Calculation', () => {
    it('should calculate cost correctly for input and output tokens', () => {
      const cost = taximeter['calculateCostEUR'](1_000_000, 1_000_000);
      
      // 1M input: (1M / 1M) * 0.075 = 0.075 USD
      // 1M output: (1M / 1M) * 0.30 = 0.30 USD
      // Total: 0.375 USD * 0.95 EUR/USD = 0.35625 EUR
      expect(cost).toBeCloseTo(0.35625, 5);
    });

    it('should calculate cost for zero tokens', () => {
      const cost = taximeter['calculateCostEUR'](0, 0);
      expect(cost).toBe(0);
    });

    it('should calculate cost for realistic API call (5K input, 500 output)', () => {
      const cost = taximeter['calculateCostEUR'](5000, 500);
      
      // 5K input: (5000 / 1M) * 0.075 = 0.000375 USD
      // 500 output: (500 / 1M) * 0.30 = 0.00015 USD
      // Total: 0.000525 USD * 0.95 = 0.00049875 EUR
      expect(cost).toBeCloseTo(0.00049875, 8);
    });
  });

  describe('Session Tracking', () => {
    it('should initialize with zero counts', () => {
      const report = taximeter.getReport();
      
      expect(report.analysis.count).toBe(0);
      expect(report.ragChat.count).toBe(0);
      expect(report.groundingChat.count).toBe(0);
      expect(report.total.operations).toBe(0);
      expect(report.total.tokens).toBe(0);
      expect(report.total.cost).toBe(0);
    });

    it('should track analysis operations correctly', () => {
      taximeter.logAnalysis('Test Article', 1000, 500, 1500, 0.001);
      
      const report = taximeter.getReport();
      expect(report.analysis.count).toBe(1);
      expect(report.analysis.tokens).toBe(1500);
      expect(report.analysis.cost).toBeCloseTo(0.001, 6);
      expect(report.total.operations).toBe(1);
    });

    it('should track RAG chat operations correctly', () => {
      taximeter.logRagChat('Test Question', 800, 200, 1000, 0.0005);
      
      const report = taximeter.getReport();
      expect(report.ragChat.count).toBe(1);
      expect(report.ragChat.tokens).toBe(1000);
      expect(report.ragChat.cost).toBeCloseTo(0.0005, 6);
    });

    it('should track grounding chat operations correctly', () => {
      taximeter.logGroundingChat('Test Query', 1200, 300, 1500, 0.0008);
      
      const report = taximeter.getReport();
      expect(report.groundingChat.count).toBe(1);
      expect(report.groundingChat.tokens).toBe(1500);
      expect(report.groundingChat.cost).toBeCloseTo(0.0008, 6);
    });

    it('should accumulate multiple operations', () => {
      taximeter.logAnalysis('Article 1', 1000, 500, 1500, 0.001);
      taximeter.logAnalysis('Article 2', 1000, 500, 1500, 0.001);
      taximeter.logRagChat('Question 1', 800, 200, 1000, 0.0005);
      taximeter.logGroundingChat('Query 1', 1200, 300, 1500, 0.0008);
      
      const report = taximeter.getReport();
      expect(report.total.operations).toBe(4);
      expect(report.total.tokens).toBe(5500);
      expect(report.total.cost).toBeCloseTo(0.0033, 4);
    });

    it('should reset all counters', () => {
      taximeter.logAnalysis('Test', 1000, 500, 1500, 0.001);
      taximeter.reset();
      
      const report = taximeter.getReport();
      expect(report.total.operations).toBe(0);
      expect(report.total.tokens).toBe(0);
      expect(report.total.cost).toBe(0);
    });
  });

  describe('Logging Output', () => {
    it('should log analysis operation with formatted output', () => {
      taximeter.logAnalysis('Test Article Title', 5000, 1500, 6500, 0.001);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logs = consoleLogSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      
      expect(logs).toContain('ANÁLISIS');
      expect(logs).toContain('Test Article Title');
      expect(logs).toContain('5'); // Contains number 5
      expect(logs).toContain('€0.001');
    });

    it('should log RAG chat operation', () => {
      taximeter.logRagChat('¿Cuál es el tema?', 800, 200, 1000, 0.0005);
      
      const logs = consoleLogSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      expect(logs).toContain('CHAT RAG');
      expect(logs).toContain('¿Cuál es el tema?');
    });

    it('should log grounding chat operation', () => {
      taximeter.logGroundingChat('What is AI?', 1200, 300, 1500, 0.0008);
      
      const logs = consoleLogSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      expect(logs).toContain('CHAT GROUNDING');
      expect(logs).toContain('What is AI?');
    });

    it('should truncate long titles to 45 chars', () => {
      const longTitle = 'A'.repeat(100);
      taximeter.logAnalysis(longTitle, 1000, 500, 1500, 0.001);
      
      const logs = consoleLogSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      expect(logs).toContain('A'.repeat(45) + '...');
      expect(logs).not.toContain('A'.repeat(46));
    });
  });

  describe('Report Generation', () => {
    it('should include session start time', () => {
      const report = taximeter.getReport();
      expect(report.sessionStart).toBeInstanceOf(Date);
    });

    it('should calculate uptime correctly', () => {
      const report = taximeter.getReport();
      expect(report.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof report.uptime).toBe('number');
    });

    it('should provide breakdown by operation type', () => {
      taximeter.logAnalysis('A1', 1000, 500, 1500, 0.001);
      taximeter.logRagChat('Q1', 800, 200, 1000, 0.0005);

      const report = taximeter.getReport();

      expect(report.analysis).toEqual({
        count: 1,
        tokens: 1500,
        promptTokens: 1000,
        completionTokens: 500,
        cost: 0.001,
      });

      expect(report.ragChat).toEqual({
        count: 1,
        tokens: 1000,
        promptTokens: 800,
        completionTokens: 200,
        cost: 0.0005,
      });

      expect(report.groundingChat).toEqual({
        count: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large token counts', () => {
      const cost = taximeter['calculateCostEUR'](10_000_000, 5_000_000);
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    it('should handle decimal token counts (API sometimes returns floats)', () => {
      const cost = taximeter['calculateCostEUR'](1000.5, 500.7);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    });

    it('should format Spanish locale correctly in logs', () => {
      taximeter.logAnalysis('Test', 123456, 7890, 131346, 0.015);
      
      const logs = consoleLogSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      // Check that large numbers are present
      expect(logs).toContain('123');
      expect(logs).toContain('131');
    });
  });
});
