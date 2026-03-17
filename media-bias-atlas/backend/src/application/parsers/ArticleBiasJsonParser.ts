import { z } from 'zod';
import { IdeologyLabel } from '../../domain/entities/ArticleBiasAnalysis';

const articleBiasResponseSchema = z.object({
  ideologyLabel: z.nativeEnum(IdeologyLabel),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(800),
  reasoningShort: z.string().trim().min(1).max(400),
}).strict();

export type ParsedArticleBiasPayload = z.infer<typeof articleBiasResponseSchema>;

export class ArticleBiasJsonParser {
  parse(rawText: string): ParsedArticleBiasPayload {
    const jsonCandidate = this.extractJsonCandidate(rawText);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonCandidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON invalido';
      throw new Error(`JSON invalido: ${message}`);
    }

    const result = articleBiasResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Payload de sesgo invalido: ${details}`);
    }

    return result.data;
  }

  private extractJsonCandidate(rawText: string): string {
    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error('La respuesta de IA llego vacia');
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
      throw new Error('No se encontro un objeto JSON en la respuesta');
    }

    return candidate.slice(start, end + 1);
  }
}
