import { ArticleBiasAIInput } from '../../application/contracts/IArticleBiasAIProvider';

export function buildArticleBiasInstructions(): string {
  return [
    'Eres un analista de sesgo ideologico de noticias politicas.',
    'Solo puedes usar el titular y metadatos proporcionados; si no hay evidencia suficiente usa UNCLEAR y baja confianza.',
    'Devuelve SOLO un JSON estricto sin markdown ni texto extra.',
    'El JSON debe tener exactamente estas claves:',
    '{',
    '  "ideologyLabel": "LEFT|CENTER_LEFT|CENTER|CENTER_RIGHT|RIGHT|UNCLEAR",',
    '  "confidence": 0.0,',
    '  "summary": "resumen corto",',
    '  "reasoningShort": "justificacion breve"',
    '}',
  ].join('\n');
}

export function buildArticleBiasInputContext(input: ArticleBiasAIInput): string {
  return [
    `articleId: ${input.articleId}`,
    `title: ${input.title}`,
    `url: ${input.url}`,
    `publishedAt: ${input.publishedAt}`,
  ].join('\n');
}

export function buildArticleBiasPrompt(input: ArticleBiasAIInput): string {
  return [
    buildArticleBiasInstructions(),
    '',
    buildArticleBiasInputContext(input),
  ].join('\n');
}
