import { z } from 'zod';

export const factualityStatusSchema = z.enum([
  'no_determinable',
  'plausible_but_unverified',
]);
export type FactualityStatus = z.infer<typeof factualityStatusSchema>;

export const analysisResponseSchema = z
  .object({
    internal_reasoning: z.string().optional(),
    summary: z.string().min(1, 'summary is required'),
    category: z.string().optional(),

    // Bias
    biasRaw: z.number().optional(),
    // Legacy input compatibility: in v4 this field represented raw bias (-10..+10)
    biasScore: z.number().optional(),
    biasScoreNormalized: z.number().optional(),

    // Reliability / traceability
    reliabilityScore: z.number().optional(),
    traceabilityScore: z.number().optional(),
    factualityStatus: factualityStatusSchema.optional(),
    evidence_needed: z.array(z.string()).optional(),
    should_escalate: z.boolean().optional(),

    // Optional legacy / compatibility blocks
    analysis: z
      .object({
        biasType: z.string().optional(),
        explanation: z.string().optional(),
      })
      .optional(),
    suggestedTopics: z.array(z.string()).max(3).optional(),
    mainTopics: z.array(z.string()).max(3).optional(),
    biasIndicators: z.array(z.string()).optional(),
    clickbaitScore: z.number().optional(),
    sentiment: z.string().optional(),
    factCheck: z
      .object({
        claims: z.array(z.string()).optional(),
        verdict: z.string().optional(),
        reasoning: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export type AnalysisResponsePayload = z.infer<typeof analysisResponseSchema>;
