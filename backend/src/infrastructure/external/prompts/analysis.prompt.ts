/**
 * Analysis Prompt Configuration
 * 
 * Versionado: Permite A/B testing sin cambios de código
 * Versión actual: v3 (XAI + AI Act compliance)
 * 
 * CHANGELOG:
 * - v1 (original): ~700 tokens, rol verboso, ejemplos en arrays
 * - v2 (optimizada): ~250 tokens, compacto, límites explícitos
 * - v3 (actual): ~280 tokens, CoT comprimido, explicabilidad AI Act UE
 */

export const ANALYSIS_PROMPT_V2 = `Analiza esta noticia. Responde SOLO con JSON válido (sin markdown, sin backticks).

TÍTULO: {title}
FUENTE: {source}
CONTENIDO:
{content}

Devuelve este JSON exacto:
{"summary":"<resumen profesional de 60-100 palabras que explique los hechos clave, contexto, implicaciones y protagonistas de forma clara y amena, sin repetir el título textualmente>","biasScore":<-10 a +10>,"biasIndicators":["<max 3 indicadores>"],"clickbaitScore":<0-100>,"reliabilityScore":<0-100>,"sentiment":"positive|neutral|negative","mainTopics":["<max 3>"],"factCheck":{"claims":["<max 2 afirmaciones clave>"],"verdict":"Verified|Mixed|Unproven|False","reasoning":"<1 frase explicativa>"}}

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
 * V3 - XAI with Chain-of-Thought + AI Act Compliance
 * Optimizado para transparencia y explicabilidad (EU AI Act Art. 13)
 */
export const ANALYSIS_PROMPT_V3 = `Analiza como experto en medios (XAI-Driven, EU AI Act compliant). Responde SOLO JSON válido (sin markdown, sin backticks).

ARTÍCULO:
Título: {title}
Fuente: {source}
Contenido: {content}

JSON requerido:
{"internal_reasoning":"<CoT paso a paso: identifica sesgo→evalúa fuentes→determina confiabilidad, max 150 chars>","summary":"<60-100 palabras: hechos, contexto, implicaciones, protagonistas sin repetir título>","biasScore":<-10 a +10>,"biasIndicators":["<max 3>"],"biasType":"<tipo: encuadre|omisión|lenguaje|selección>","clickbaitScore":<0-100>,"reliabilityScore":<0-100>,"sentiment":"positive|neutral|negative","mainTopics":["<max 3>"],"factCheck":{"claims":["<max 2>"],"verdict":"Verified|Mixed|Unproven|False","reasoning":"<1 frase>"},"aiActExplanation":"<Por qué este análisis (transparencia AI Act), max 280 chars>"}

ESCALAS: biasScore(-10=izq,+10=der), clickbait(0=serio,100=engañoso), reliability(0=bulo,100=verificado)

REGLAS summary: NO repetir título, incluir QUÉ/QUIÉN/CUÁNDO/DÓNDE/POR QUÉ, tono periodístico profesional`;

/**
 * Active analysis prompt (selecciona versión a usar)
 * Cambiar aquí para A/B testing
 */
export const ANALYSIS_PROMPT = ANALYSIS_PROMPT_V3;

/**
 * Límite de caracteres para contenido de artículo en análisis.
 * Evita enviar artículos enormes que consumen tokens innecesarios.
 */
export const MAX_ARTICLE_CONTENT_LENGTH = 8000;
