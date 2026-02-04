/**
 * TokenTaximeter - Cost Tracking for AI API Operations
 * 
 * ZONA CRÍTICA (CALIDAD.md): Maneja cálculos de costes y tokens
 * Cobertura requerida: 100%
 * 
 * Responsabilidades:
 * - Calcular costes en EUR basado en tokens consumidos
 * - Acumular estadísticas de sesión por tipo de operación
 * - Generar logs visuales formateados
 * - Proveer reportes de costes acumulados
 */

// Pricing constants - Gemini 2.5 Flash
// Fuente: https://ai.google.dev/pricing
const PRICE_INPUT_1M = 0.075;  // USD per 1M input tokens
const PRICE_OUTPUT_1M = 0.30;  // USD per 1M output tokens
const EUR_USD_RATE = 0.95;     // EUR/USD conversion rate

interface SessionCostAccumulator {
  analysisCount: number;
  analysisTotalTokens: number;
  analysisTotalCost: number;
  ragChatCount: number;
  ragChatTotalTokens: number;
  ragChatTotalCost: number;
  groundingChatCount: number;
  groundingChatTotalTokens: number;
  groundingChatTotalCost: number;
  sessionStart: Date;
}

export interface CostReport {
  analysis: { count: number; tokens: number; cost: number };
  ragChat: { count: number; tokens: number; cost: number };
  groundingChat: { count: number; tokens: number; cost: number };
  total: { operations: number; tokens: number; cost: number };
  sessionStart: Date;
  uptime: number;
}

export class TokenTaximeter {
  private session: SessionCostAccumulator;

  constructor() {
    this.session = {
      analysisCount: 0,
      analysisTotalTokens: 0,
      analysisTotalCost: 0,
      ragChatCount: 0,
      ragChatTotalTokens: 0,
      ragChatTotalCost: 0,
      groundingChatCount: 0,
      groundingChatTotalTokens: 0,
      groundingChatTotalCost: 0,
      sessionStart: new Date(),
    };
  }

  /**
   * Calculate cost in EUR from token counts
   */
  private calculateCostEUR(promptTokens: number, completionTokens: number): number {
    const costInputUSD = (promptTokens / 1_000_000) * PRICE_INPUT_1M;
    const costOutputUSD = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M;
    return (costInputUSD + costOutputUSD) * EUR_USD_RATE;
  }

  /**
   * Log analysis operation with visual taximeter
   */
  logAnalysis(
    title: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    costEUR: number
  ): void {
    this.session.analysisCount++;
    this.session.analysisTotalTokens += totalTokens;
    this.session.analysisTotalCost += costEUR;

    this.logTaximeter('ANÁLISIS', '📰', title, promptTokens, completionTokens, totalTokens, costEUR);
  }

  /**
   * Log RAG chat operation
   */
  logRagChat(
    question: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    costEUR: number
  ): void {
    this.session.ragChatCount++;
    this.session.ragChatTotalTokens += totalTokens;
    this.session.ragChatTotalCost += costEUR;

    this.logTaximeter('CHAT RAG', '💬', question, promptTokens, completionTokens, totalTokens, costEUR);
  }

  /**
   * Log grounding chat operation (with Google Search)
   */
  logGroundingChat(
    query: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    costEUR: number
  ): void {
    this.session.groundingChatCount++;
    this.session.groundingChatTotalTokens += totalTokens;
    this.session.groundingChatTotalCost += costEUR;

    this.logTaximeter('CHAT GROUNDING', '🌐', query, promptTokens, completionTokens, totalTokens, costEUR);
  }

  /**
   * Display visual taximeter log
   */
  private logTaximeter(
    operationType: string,
    emoji: string,
    title: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    costEUR: number
  ): void {
    const titlePreview = title.substring(0, 45) + (title.length > 45 ? '...' : '');

    console.log(`\n      🧾 ═══════════════════════════════════════════════════════════`);
    console.log(`      🧾 TOKEN TAXIMETER - ${operationType}`);
    console.log(`      🧾 ═══════════════════════════════════════════════════════════`);
    console.log(`      ${emoji} ${operationType === 'ANÁLISIS' ? 'Título' : 'Pregunta'}: "${titlePreview}"`);
    console.log(`      🧠 Tokens entrada:  ${promptTokens.toLocaleString('es-ES')}`);
    console.log(`      🧠 Tokens salida:   ${completionTokens.toLocaleString('es-ES')}`);
    console.log(`      🧠 Tokens TOTAL:    ${totalTokens.toLocaleString('es-ES')}`);
    console.log(`      💰 Coste operación: €${costEUR.toFixed(6)}`);
    console.log(`      🧾 ───────────────────────────────────────────────────────────`);

    // Show accumulated session stats
    const totalSessionCost = this.session.analysisTotalCost + this.session.ragChatTotalCost + this.session.groundingChatTotalCost;
    const totalSessionTokens = this.session.analysisTotalTokens + this.session.ragChatTotalTokens + this.session.groundingChatTotalTokens;
    const totalOperations = this.session.analysisCount + this.session.ragChatCount + this.session.groundingChatCount;

    console.log(`      📊 SESIÓN ACUMULADA (desde ${this.session.sessionStart.toLocaleTimeString('es-ES')}):`);
    console.log(`      📊 Análisis: ${this.session.analysisCount} ops | ${this.session.analysisTotalTokens.toLocaleString('es-ES')} tokens | €${this.session.analysisTotalCost.toFixed(6)}`);
    console.log(`      📊 Chat RAG: ${this.session.ragChatCount} ops | ${this.session.ragChatTotalTokens.toLocaleString('es-ES')} tokens | €${this.session.ragChatTotalCost.toFixed(6)}`);
    console.log(`      📊 Grounding: ${this.session.groundingChatCount} ops | ${this.session.groundingChatTotalTokens.toLocaleString('es-ES')} tokens | €${this.session.groundingChatTotalCost.toFixed(6)}`);
    console.log(`      💰 TOTAL SESIÓN: ${totalOperations} ops | ${totalSessionTokens.toLocaleString('es-ES')} tokens | €${totalSessionCost.toFixed(6)}`);
    console.log(`      🧾 ═══════════════════════════════════════════════════════════\n`);
  }

  /**
   * Get comprehensive cost report
   */
  getReport(): CostReport {
    const totalSessionCost = this.session.analysisTotalCost + this.session.ragChatTotalCost + this.session.groundingChatTotalCost;
    const totalSessionTokens = this.session.analysisTotalTokens + this.session.ragChatTotalTokens + this.session.groundingChatTotalTokens;
    const totalOperations = this.session.analysisCount + this.session.ragChatCount + this.session.groundingChatCount;

    return {
      analysis: {
        count: this.session.analysisCount,
        tokens: this.session.analysisTotalTokens,
        cost: this.session.analysisTotalCost,
      },
      ragChat: {
        count: this.session.ragChatCount,
        tokens: this.session.ragChatTotalTokens,
        cost: this.session.ragChatTotalCost,
      },
      groundingChat: {
        count: this.session.groundingChatCount,
        tokens: this.session.groundingChatTotalTokens,
        cost: this.session.groundingChatTotalCost,
      },
      total: {
        operations: totalOperations,
        tokens: totalSessionTokens,
        cost: totalSessionCost,
      },
      sessionStart: this.session.sessionStart,
      uptime: Date.now() - this.session.sessionStart.getTime(),
    };
  }

  /**
   * Reset all session counters (for testing)
   */
  reset(): void {
    this.session = {
      analysisCount: 0,
      analysisTotalTokens: 0,
      analysisTotalCost: 0,
      ragChatCount: 0,
      ragChatTotalTokens: 0,
      ragChatTotalCost: 0,
      groundingChatCount: 0,
      groundingChatTotalTokens: 0,
      groundingChatTotalCost: 0,
      sessionStart: new Date(),
    };
  }

  /**
   * Calculate cost from tokens (exposed for external use)
   */
  calculateCost(promptTokens: number, completionTokens: number): number {
    return this.calculateCostEUR(promptTokens, completionTokens);
  }
}
