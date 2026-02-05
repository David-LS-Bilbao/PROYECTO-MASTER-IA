/**
 * Centralized Constants Configuration
 * ====================================
 *
 * This file consolidates all magic numbers and configuration constants
 * used across the application (Sprint 14 - Technical Debt #10)
 *
 * Organization:
 * 1. GEMINI_PRICING - API pricing per token
 * 2. CURRENCY_RATES - Currency conversion rates
 * 3. RAG_CONFIG - Retrieval-Augmented Generation limits
 * 4. BATCH_CONFIG - Batch processing limits
 * 5. CONTENT_CONFIG - Content length constraints
 * 6. USER_PLANS - User subscription plan definitions
 * 7. API_LIMITS - Rate limiting and API constraints
 */

// ============================================================================
// 1. GEMINI PRICING (USD per 1M tokens)
// ============================================================================
// Source: https://ai.google.dev/pricing
// Last updated: 2026-02-05
// Model: Gemini 2.5 Flash

export const GEMINI_PRICING = {
  /** Input tokens cost in USD per 1M tokens */
  INPUT_COST_PER_1M_TOKENS: 0.075,

  /** Output tokens cost in USD per 1M tokens */
  OUTPUT_COST_PER_1M_TOKENS: 0.30,
} as const;

// ============================================================================
// 2. CURRENCY RATES
// ============================================================================
// EUR/USD conversion rate for cost reporting in EUR
// Used by TokenTaximeter for monthly billing reports

export const CURRENCY_RATES = {
  /** EUR to USD conversion rate */
  EUR_USD_RATE: 0.95,

  /** USD to EUR conversion rate (inverse) */
  USD_EUR_RATE: 1 / 0.95,
} as const;

// ============================================================================
// 3. RAG CONFIGURATION (Retrieval-Augmented Generation)
// ============================================================================
// Controls document retrieval and context building for LLM prompts

export const RAG_CONFIG = {
  /** Maximum number of documents retrieved from ChromaDB */
  MAX_RAG_DOCUMENTS: 3,

  /** Maximum characters per document fragment to avoid token bloat */
  MAX_DOCUMENT_CHARS: 2000,

  /** Maximum characters for fallback context when ChromaDB unavailable */
  MAX_FALLBACK_CONTENT_CHARS: 3000,

  /** Maximum output words for RAG chat responses */
  MAX_RESPONSE_WORDS: 120,
} as const;

// ============================================================================
// 4. BATCH PROCESSING CONFIGURATION
// ============================================================================
// Controls batch operations to prevent unexpected costs

export const BATCH_CONFIG = {
  /** Maximum articles per batch in analysis operations */
  MAX_BATCH_SIZE: 100,

  /** Maximum items per source in ingestion */
  MAX_ITEMS_PER_SOURCE: 5,
} as const;

// ============================================================================
// 5. CONTENT CONSTRAINTS
// ============================================================================
// Validation limits for content processing

export const CONTENT_CONFIG = {
  /** Minimum content length to justify AI processing */
  MIN_CONTENT_LENGTH: 100,

  /** Maximum characters for text embedding to avoid token waste */
  MAX_EMBEDDING_TEXT_LENGTH: 6000,

  /** Maximum characters for article content in fallback scenarios */
  MAX_ARTICLE_CONTENT_LENGTH: 4000,

  /** Preview length for UI display */
  TITLE_PREVIEW_LENGTH: 45,
} as const;

// ============================================================================
// 6. USER PLANS & QUOTAS
// ============================================================================
// Define usage limits for different subscription tiers

export const USER_PLANS = {
  FREE: {
    name: 'Free',
    dailyAnalysisLimit: 50,
    monthlyAnalysisLimit: 500,
    monthlyChatLimit: 20,
    monthlyGroundingLimit: 10,
  },

  PRO: {
    name: 'Professional',
    dailyAnalysisLimit: 500,
    monthlyAnalysisLimit: 5000,
    monthlyChatLimit: 200,
    monthlyGroundingLimit: 100,
  },

  ENTERPRISE: {
    name: 'Enterprise',
    dailyAnalysisLimit: 10000,
    monthlyAnalysisLimit: 100000,
    monthlyChatLimit: 5000,
    monthlyGroundingLimit: 2500,
  },
} as const;

// ============================================================================
// 7. API LIMITS & RATE LIMITING
// ============================================================================
// Controls API behavior and rate limiting

export const API_LIMITS = {
  /** Maximum concurrent requests per user */
  MAX_CONCURRENT_REQUESTS: 5,

  /** Rate limit: requests per minute per user */
  RATE_LIMIT_RPM: 60,

  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 30000,

  /** Maximum retries for transient failures */
  MAX_RETRIES: 3,

  /** Retry backoff multiplier (exponential) */
  RETRY_BACKOFF_MULTIPLIER: 2,

  /** Initial retry delay in milliseconds */
  INITIAL_RETRY_DELAY_MS: 1000,
} as const;

// ============================================================================
// HELPER FUNCTIONS FOR COST CALCULATIONS
// ============================================================================

/**
 * Calculate cost in EUR from token counts
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Cost in EUR
 */
export function calculateCostEUR(promptTokens: number, completionTokens: number): number {
  const costInputUSD = (promptTokens / 1_000_000) * GEMINI_PRICING.INPUT_COST_PER_1M_TOKENS;
  const costOutputUSD = (completionTokens / 1_000_000) * GEMINI_PRICING.OUTPUT_COST_PER_1M_TOKENS;
  return (costInputUSD + costOutputUSD) * CURRENCY_RATES.EUR_USD_RATE;
}

/**
 * Get user plan configuration by plan type
 * @param planType - User plan type (FREE, PRO, ENTERPRISE)
 * @returns Plan configuration object
 */
export function getUserPlanConfig(planType: 'FREE' | 'PRO' | 'ENTERPRISE' = 'FREE') {
  return USER_PLANS[planType];
}

/**
 * Get daily analysis limit for user plan
 * @param planType - User plan type
 * @returns Daily analysis limit
 */
export function getDailyAnalysisLimit(planType: 'FREE' | 'PRO' | 'ENTERPRISE' = 'FREE'): number {
  return USER_PLANS[planType].dailyAnalysisLimit;
}

/**
 * Get monthly chat limit for user plan
 * @param planType - User plan type
 * @returns Monthly chat limit
 */
export function getMonthlyChatLimit(planType: 'FREE' | 'PRO' | 'ENTERPRISE' = 'FREE'): number {
  return USER_PLANS[planType].monthlyChatLimit;
}

// ============================================================================
// TYPE EXPORTS FOR TYPESCRIPT
// ============================================================================

export type PlanType = keyof typeof USER_PLANS;
export type UserPlanConfig = typeof USER_PLANS[PlanType];
