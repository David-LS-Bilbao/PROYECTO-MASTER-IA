/**
 * RSS Discovery Prompt Configuration
 *
 * Mapeo HTML -> Lista URLs con regla de Confianza de Formato
 * Version: v2 (optimizada precision estructural)
 */

export const RSS_DISCOVERY_PROMPT_VERSION = '2.0.0';
export const RSS_DISCOVERY_PROMPT_TEMPLATE = `INPUT: '{mediaName}'
OUTPUT: URL feed RSS oficial

REGLA CONFIANZA DE FORMATO:
- SOLO URLs terminadas en .xml, .rss O que contengan /feed/
- Si no cumple formato valido -> 'null'
- Sin texto adicional, sin markdown`;

export const LOCATION_SOURCES_PROMPT_VERSION = '1.0.0';
export const LOCATION_SOURCES_PROMPT_TEMPLATE = `TAREA: Identifica los 5 medios de noticias digitales MAS IMPORTANTES que cubran noticias de "{city}" (Espana).

CRITERIOS DE SELECCION (en orden de prioridad):
1. Medios estrictamente locales con sede o redaccion en {city} o su municipio
2. Si no existen suficientes medios locales: periodicos provinciales/regionales que cubran {city}
3. Si {city} es una localidad pequena o municipio de una gran ciudad: incluir los medios de la capital de provincia o comunidad autonoma que habitualmente cubren esa zona
4. Priorizar: periodicos digitales consolidados > radios digitales > TV locales > portales independientes
5. Permitir ediciones locales de medios regionales si tienen cobertura especifica de {city}

FORMATO DE SALIDA (JSON estricto):
[
  {
    "name": "Nombre del medio",
    "domain": "https://www.levante-emv.com",
    "media_group": "Prensa Iberica",
    "reliability": "high"
  }
]

INSTRUCCIONES PARA CADA CAMPO:
- "name": Nombre oficial del medio (ej: "Levante-EMV", "Las Provincias")
- "domain": URL de la pagina principal (homepage limpia, sin rutas adicionales)
  - Formato: https://www.[dominio].com
  - NO inventes subdominios (solo el principal)
  - Ejemplos validos: "https://www.levante-emv.com", "https://www.eldiario.es"
- "media_group": Grupo editorial al que pertenece (si lo conoces), o "Independent" / "Unknown"
- "reliability": "high" (>10 anos, grupo conocido) | "medium" (5-10 anos) | "low" (portal local pequeno)

REGLAS ESTRICTAS:
1. NO predecir URLs RSS - SOLO proporcionar el dominio principal
2. NO inventar dominios - si no conoces el dominio exacto, OMITE ese medio
3. Los dominios deben ser reales y verificables

IMPORTANTE:
- Devolver SOLO el array JSON, SIN markdown (\`\`\`json), SIN explicaciones
- Maximo 5 fuentes, minimo 1
- Si {city} es un municipio pequeno, prioriza los medios de la provincia/comunidad que lo cubran
- NUNCA devolver array vacio [] si existen medios provinciales/regionales que cubran la zona`;

/**
 * Genera prompt para buscar feed RSS de un medio
 *
 * @param mediaName - Nombre del medio de comunicacion
 * @returns Prompt para enviar a Gemini
 */
export function buildRssDiscoveryPrompt(mediaName: string): string {
  return RSS_DISCOVERY_PROMPT_TEMPLATE.replace('{mediaName}', mediaName);
}

/**
 * Sprint 24.1: Genera prompt para identificar fuentes locales de noticias de una ciudad
 *
 * REFACTORIZACION: En lugar de predecir URLs RSS (alta tasa de error), ahora pedimos:
 * 1. Identificar los 5 medios digitales mas importantes de la ciudad/region
 * 2. Proporcionar el dominio principal (homepage URL limpia)
 * 3. Identificar el grupo editorial si es conocido (Vocento, Prensa Iberica, etc.)
 * 4. Asignar nivel de confiabilidad
 * 5. Devolver SOLO JSON valido, sin markdown, sin explicaciones
 *
 * @param city - Nombre de la ciudad/region espanola (ej: "Bilbao", "Comunidad Valenciana")
 * @returns Prompt estructurado para extraccion de fuentes locales
 */
export function buildLocationSourcesPrompt(city: string): string {
  return LOCATION_SOURCES_PROMPT_TEMPLATE.replaceAll('{city}', city);
}
