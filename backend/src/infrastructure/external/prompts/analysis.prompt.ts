/**
 * Analysis Prompt Configuration
 * 
 * Versionado: Permite A/B testing sin cambios de código
 * Versión actual: v2 (optimizada - 65% reducción de tokens)
 * 
 * CHANGELOG:
 * - v1 (original): ~700 tokens, rol verboso, ejemplos en arrays
 * - v2 (actual): ~250 tokens, compacto, límites explícitos
 */

export const ANALYSIS_PROMPT_V2 = `Analiza esta noticia. Responde SOLO con JSON válido (sin markdown, sin backticks).

TÍTULO: {title}
FUENTE: {source}
CONTENIDO:
{content}

Devuelve este JSON exacto:
{"summary":"<resumen profesional de 120-150 palabras que explique los hechos clave, contexto, implicaciones y protagonistas de forma clara y amena, sin repetir el título textualmente>","biasScore":<-10 a +10>,"biasIndicators":["<max 3 indicadores>"],"clickbaitScore":<0-100>,"reliabilityScore":<0-100>,"sentiment":"positive|neutral|negative","mainTopics":["<max 3>"],"factCheck":{"claims":["<max 2 afirmaciones clave>"],"verdict":"Verified|Mixed|Unproven|False","reasoning":"<1 frase explicativa>"}}

ESCALAS:
- biasScore: -10=izquierda extrema, 0=neutral, +10=derecha extrema
- clickbaitScore: 0=serio, 50=sensacionalista, 100=engañoso
- reliabilityScore: 0=bulo, 50=parcial, 100=verificado con fuentes oficiales
- verdict: Verified=comprobado, Mixed=parcial, Unproven=sin datos, False=falso

IMPORTANTE para el summary: 
- NO repitas el título textualmente
- Explica QUÉ pasó, QUIÉN está involucrado, CUÁNDO, DÓNDE y POR QUÉ
- Incluye contexto relevante y consecuencias
- Usa un tono periodístico profesional
- Debe ser fácil de leer y comprender`;

/**
 * Active analysis prompt (selecciona versión a usar)
 * Cambiar aquí para A/B testing
 */
export const ANALYSIS_PROMPT = ANALYSIS_PROMPT_V2;

/**
 * Límite de caracteres para contenido de artículo en análisis.
 * Evita enviar artículos enormes que consumen tokens innecesarios.
 */
export const MAX_ARTICLE_CONTENT_LENGTH = 8000;
