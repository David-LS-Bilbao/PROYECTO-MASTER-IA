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
 *
 * DEUDA TÉCNICA #10 (Sprint 14): Magic numbers centralizados en constants.ts
 *
 * OBSERVABILIDAD (Sprint 15 - Paso 4):
 * - Envío de custom metrics a Sentry
 * - Dashboards de costes y tokens en tiempo real
 */

import { GEMINI_PRICING, CURRENCY_RATES, CONTENT_CONFIG } from '../../config/constants';
import * as Sentry from '@sentry/node';

interface SessionCostAccumulator {
  analysisCount: number;
  analysisTotalTokens: number;
  analysisPromptTokens: number;
  analysisCompletionTokens: number;
  analysisTotalCost: number;
  ragChatCount: number;
  ragChatTotalTokens: number;
  ragChatPromptTokens: number;
  ragChatCompletionTokens: number;
  ragChatTotalCost: number;
  groundingChatCount: number;
  groundingChatTotalTokens: number;
  groundingChatPromptTokens: number;
  groundingChatCompletionTokens: number;
  groundingChatTotalCost: number;
  sessionStart: Date;
}

export interface CostReport {
  analysis: { count: number; tokens: number; promptTokens: number; completionTokens: number; cost: number };
  ragChat: { count: number; tokens: number; promptTokens: number; completionTokens: number; cost: number };
  groundingChat: { count: number; tokens: number; promptTokens: number; completionTokens: number; cost: number };
  total: { operations: number; tokens: number; totalTokens: number; promptTokens: number; completionTokens: number; cost: number };
  sessionStart: Date;
  uptime: number;
}

export class TokenTaximeter {
  private session: SessionCostAccumulator;

  constructor() {
    this.session = {
      analysisCount: 0,
      analysisTotalTokens: 0,
      analysisPromptTokens: 0,
      analysisCompletionTokens: 0,
      analysisTotalCost: 0,
      ragChatCount: 0,
      ragChatTotalTokens: 0,
      ragChatPromptTokens: 0,
      ragChatCompletionTokens: 0,
      ragChatTotalCost: 0,
      groundingChatCount: 0,
      groundingChatTotalTokens: 0,
      groundingChatPromptTokens: 0,
      groundingChatCompletionTokens: 0,
      groundingChatTotalCost: 0,
      sessionStart: new Date(),
    };
  }

  /**
   * Calculate cost in EUR from token counts
   */
  private calculateCostEUR(promptTokens: number, completionTokens: number): number {
    const costInputUSD = (promptTokens / 1_000_000) * GEMINI_PRICING.INPUT_COST_PER_1M_TOKENS;
    const costOutputUSD = (completionTokens / 1_000_000) * GEMINI_PRICING.OUTPUT_COST_PER_1M_TOKENS;
    return (costInputUSD + costOutputUSD) * CURRENCY_RATES.EUR_USD_RATE;
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
    this.session.analysisPromptTokens += promptTokens;
    this.session.analysisCompletionTokens += completionTokens;
    this.session.analysisTotalCost += costEUR;

    // 🔍 Sprint 15 - Paso 4: Custom Metrics to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.metrics.gauge('verity.analysis.count', 1, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.tokens.prompt', promptTokens, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.tokens.completion', completionTokens, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.tokens.total', totalTokens, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.cost.eur', costEUR, {
        unit: 'none',
      });
    }

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
    this.session.ragChatPromptTokens += promptTokens;
    this.session.ragChatCompletionTokens += completionTokens;
    this.session.ragChatTotalCost += costEUR;

    // 🔍 Sprint 15 - Paso 4: Custom Metrics to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.metrics.gauge('verity.chat.rag.count', 1, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.chat.rag.tokens', totalTokens, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.chat.rag.cost', costEUR, {
        unit: 'none',
      });
    }

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
    this.session.groundingChatPromptTokens += promptTokens;
    this.session.groundingChatCompletionTokens += completionTokens;
    this.session.groundingChatTotalCost += costEUR;

    // 🔍 Sprint 15 - Paso 4: Custom Metrics to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.metrics.gauge('verity.chat.grounding.count', 1, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.chat.grounding.tokens', totalTokens, {
        unit: 'none',
      });
      Sentry.metrics.gauge('verity.chat.grounding.cost', costEUR, {
        unit: 'none',
      });
      // Métrica específica de grounding para saber cuándo se usa Google Search
      Sentry.metrics.gauge('verity.grounding.used', 1, {
        unit: 'none',
      });
    }

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
    const titlePreview = title.substring(0, CONTENT_CONFIG.TITLE_PREVIEW_LENGTH) + (title.length > CONTENT_CONFIG.TITLE_PREVIEW_LENGTH ? '...' : '');

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
    const totalPromptTokens = this.session.analysisPromptTokens + this.session.ragChatPromptTokens + this.session.groundingChatPromptTokens;
    const totalCompletionTokens = this.session.analysisCompletionTokens + this.session.ragChatCompletionTokens + this.session.groundingChatCompletionTokens;
    const totalOperations = this.session.analysisCount + this.session.ragChatCount + this.session.groundingChatCount;

    return {
      analysis: {
        count: this.session.analysisCount,
        tokens: this.session.analysisTotalTokens,
        promptTokens: this.session.analysisPromptTokens,
        completionTokens: this.session.analysisCompletionTokens,
        cost: this.session.analysisTotalCost,
      },
      ragChat: {
        count: this.session.ragChatCount,
        tokens: this.session.ragChatTotalTokens,
        promptTokens: this.session.ragChatPromptTokens,
        completionTokens: this.session.ragChatCompletionTokens,
        cost: this.session.ragChatTotalCost,
      },
      groundingChat: {
        count: this.session.groundingChatCount,
        tokens: this.session.groundingChatTotalTokens,
        promptTokens: this.session.groundingChatPromptTokens,
        completionTokens: this.session.groundingChatCompletionTokens,
        cost: this.session.groundingChatTotalCost,
      },
      total: {
        operations: totalOperations,
        tokens: totalSessionTokens,
        totalTokens: totalSessionTokens,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
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
      analysisPromptTokens: 0,
      analysisCompletionTokens: 0,
      analysisTotalCost: 0,
      ragChatCount: 0,
      ragChatTotalTokens: 0,
      ragChatPromptTokens: 0,
      ragChatCompletionTokens: 0,
      ragChatTotalCost: 0,
      groundingChatCount: 0,
      groundingChatTotalTokens: 0,
      groundingChatPromptTokens: 0,
      groundingChatCompletionTokens: 0,
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
