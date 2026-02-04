/**
 * Analysis Prompt Configuration
 *
 * Versión actual: v4 (schema reestructurado + XAI + AI Act compliance)
 *
 * CHANGELOG:
 * - v1 (original): ~700 tokens, rol verboso, ejemplos en arrays
 * - v2 (optimizada): ~250 tokens, compacto, límites explícitos
 * - v3: ~280 tokens, CoT comprimido, explicabilidad AI Act UE
 * - v4 (actual): schema limpio, analysis nested, sin factualClaims legacy
 */

export const ANALYSIS_PROMPT = `Analiza esta noticia como experto en medios (XAI-Driven, EU AI Act compliant).
Responde SOLO con JSON válido (sin markdown, sin backticks).

ARTÍCULO:
Título: {title}
Fuente: {source}
Contenido: {content}

JSON requerido:
{
  "internal_reasoning": "<Chain-of-Thought: identifica sesgo, evalúa fuentes, determina confiabilidad. Max 150 chars>",
  "summary": "<Resumen periodístico de 60-100 palabras: QUÉ/QUIÉN/CUÁNDO/DÓNDE/POR QUÉ sin repetir título>",
  "category": "<Categoría principal: política|economía|tecnología|deportes|cultura|ciencia|mundo|sociedad>",
  "biasScore": "<Entero de -10 (extrema izquierda) a +10 (extrema derecha), 0 = neutral>",
  "reliabilityScore": "<Entero de 0 (bulo/falso) a 100 (verificado con fuentes oficiales)>",
  "suggestedTopics": ["<máximo 3 temas principales del artículo>"],
  "analysis": {
    "biasType": "<Tipo de sesgo detectado: encuadre|omisión|lenguaje|selección|ninguno>",
    "explanation": "<Explicación transparencia AI Act: por qué se asignaron estos scores. Max 280 chars>"
  }
}

ESCALAS:
- biasScore: -10 = izquierda extrema, 0 = neutral, +10 = derecha extrema
- reliabilityScore: 0 = bulo, 50 = parcial, 100 = verificado con fuentes oficiales

REGLAS SUMMARY:
- NO repitas el título textualmente
- Incluye QUÉ pasó, QUIÉN está involucrado, CUÁNDO, DÓNDE y POR QUÉ
- Tono periodístico profesional, fácil de leer`;

/**
 * Límite de caracteres para contenido de artículo en análisis.
 * Evita enviar artículos enormes que consumen tokens innecesarios.
 */
export const MAX_ARTICLE_CONTENT_LENGTH = 8000;
