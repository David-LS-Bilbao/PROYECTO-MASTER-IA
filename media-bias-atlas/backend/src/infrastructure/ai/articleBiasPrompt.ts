import { ArticleBiasAIInput } from '../../application/contracts/IArticleBiasAIProvider';

export const ARTICLE_BIAS_PROMPT_SOURCE_FILE = 'src/infrastructure/ai/articleBiasPrompt.ts';
export const ARTICLE_BIAS_PROMPT_VERSION = '1.0.0';
export const ARTICLE_BIAS_PROMPT_KEY = 'article_bias_prompt';
export const ARTICLE_BIAS_INSTRUCTIONS_PROMPT_KEY = 'article_bias_instructions';
export const ARTICLE_BIAS_INPUT_CONTEXT_PROMPT_KEY = 'article_bias_input_context';

export const ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE = [
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

export const ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE = [
  'articleId: {{articleId}}',
  'title: {{title}}',
  'url: {{url}}',
  'publishedAt: {{publishedAt}}',
].join('\n');

export const ARTICLE_BIAS_PROMPT_TEMPLATE = [
  ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE,
  '',
  ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE,
].join('\n');

export function buildArticleBiasInstructions(): string {
  return ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE;
}

export function buildArticleBiasInputContext(input: ArticleBiasAIInput): string {
  return ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE
    .replace('{{articleId}}', input.articleId)
    .replace('{{title}}', input.title)
    .replace('{{url}}', input.url)
    .replace('{{publishedAt}}', input.publishedAt);
}

export function buildArticleBiasPrompt(input: ArticleBiasAIInput): string {
  return ARTICLE_BIAS_PROMPT_TEMPLATE
    .replace(ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE, buildArticleBiasInstructions())
    .replace(ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE, buildArticleBiasInputContext(input));
}
