/**
 * RSS Discovery Prompt Configuration
 * 
 * Mapeo HTML → Lista URLs con regla de Confianza de Formato
 * Versión: v2 (optimizada precisión estructural)
 */

/**
 * Genera prompt para buscar feed RSS de un medio
 *
 * @param mediaName - Nombre del medio de comunicación
 * @returns Prompt para enviar a Gemini
 */
export function buildRssDiscoveryPrompt(mediaName: string): string {
  return `INPUT: '${mediaName}'
OUTPUT: URL feed RSS oficial

REGLA CONFIANZA DE FORMATO:
- SOLO URLs terminadas en .xml, .rss O que contengan /feed/
- Si no cumple formato válido → 'null'
- Sin texto adicional, sin markdown`;
}

/**
 * Sprint 24.1: Genera prompt para identificar fuentes locales de noticias de una ciudad
 *
 * REFACTORIZACIÓN: En lugar de predecir URLs RSS (alta tasa de error), ahora pedimos:
 * 1. Identificar los 5 medios digitales más importantes de la ciudad/región
 * 2. Proporcionar el dominio principal (homepage URL limpia)
 * 3. Identificar el grupo editorial si es conocido (Vocento, Prensa Ibérica, etc.)
 * 4. Asignar nivel de confiabilidad
 * 5. Devolver SOLO JSON válido, sin markdown, sin explicaciones
 *
 * VENTAJAS:
 * - Reduce alucinaciones (dominios son más conocidos que URLs RSS específicas)
 * - Permite web scraping posterior para descubrir RSS feeds reales
 * - Información de grupo editorial útil para credibilidad
 *
 * @param city - Nombre de la ciudad/región española (ej: "Bilbao", "Comunidad Valenciana")
 * @returns Prompt estructurado para extracción de fuentes locales
 */
export function buildLocationSourcesPrompt(city: string): string {
  return `TAREA: Identifica los 5 medios de noticias digitales MÁS IMPORTANTES que cubran noticias de "${city}" (España).

CRITERIOS DE SELECCIÓN (en orden de prioridad):
1. Medios estrictamente locales con sede o redacción en ${city} o su municipio
2. Si no existen suficientes medios locales: periódicos provinciales/regionales que cubran ${city}
3. Si ${city} es una localidad pequeña o municipio de una gran ciudad: incluir los medios de la capital de provincia o comunidad autónoma que habitualmente cubren esa zona
4. Priorizar: periódicos digitales consolidados > radios digitales > TV locales > portales independientes
5. Permitir ediciones locales de medios regionales si tienen cobertura específica de ${city}

FORMATO DE SALIDA (JSON estricto):
[
  {
    "name": "Nombre del medio",
    "domain": "https://www.levante-emv.com",
    "media_group": "Prensa Ibérica",
    "reliability": "high"
  }
]

INSTRUCCIONES PARA CADA CAMPO:
- "name": Nombre oficial del medio (ej: "Levante-EMV", "Las Provincias")
- "domain": URL de la página principal (homepage limpia, sin rutas adicionales)
  - Formato: https://www.[dominio].com
  - NO inventes subdominios (solo el principal)
  - Ejemplos válidos: "https://www.levante-emv.com", "https://www.eldiario.es"
- "media_group": Grupo editorial al que pertenece (si lo conoces), o "Independent" / "Unknown"
- "reliability": "high" (>10 años, grupo conocido) | "medium" (5-10 años) | "low" (portal local pequeño)

REGLAS ESTRICTAS:
1. NO predecir URLs RSS - SOLO proporcionar el dominio principal
2. NO inventar dominios - si no conoces el dominio exacto, OMITE ese medio
3. Los dominios deben ser reales y verificables

IMPORTANTE:
- Devolver SOLO el array JSON, SIN markdown (\`\`\`json), SIN explicaciones
- Máximo 5 fuentes, mínimo 1
- Si ${city} es un municipio pequeño, prioriza los medios de la provincia/comunidad que lo cubran
- NUNCA devolver array vacío [] si existen medios provinciales/regionales que cubran la zona`;
}

