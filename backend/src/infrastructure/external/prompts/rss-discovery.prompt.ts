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
 * Sprint 24: Genera prompt para identificar fuentes locales de noticias de una ciudad
 *
 * Instrucciones para Gemini:
 * 1. Identificar los 5 medios digitales más importantes de la ciudad/región
 * 2. Predecir sus URLs de feeds RSS (formato válido: .xml, .rss, /feed/)
 * 3. Asignar nivel de confiabilidad basado en:
 *    - "high": Medios consolidados con presencia digital verificada (>10 años)
 *    - "medium": Medios regionales conocidos con presencia digital
 *    - "low": Medios locales pequeños o blogs
 * 4. Devolver SOLO JSON válido, sin markdown, sin explicaciones
 *
 * @param city - Nombre de la ciudad/región española (ej: "Bilbao", "Comunidad Valenciana")
 * @returns Prompt estructurado para extracción de fuentes locales
 */
export function buildLocationSourcesPrompt(city: string): string {
  return `TAREA: Identifica los 5 medios de noticias digitales MÁS IMPORTANTES y FIABLES específicos para "${city}" (España).

CRITERIOS DE SELECCIÓN:
1. Medios con sede física o redacción en ${city} o su área metropolitana
2. Cobertura principal: noticias locales de ${city}
3. Priorizar: periódicos digitales consolidados > radios digitales > TV locales > portales independientes
4. Excluir: medios nacionales (El País, ABC, etc.) salvo ediciones locales específicas

FORMATO DE SALIDA (JSON estricto):
[
  {
    "name": "Nombre del medio",
    "url": "https://dominio.com/rss/portada.xml",
    "reliability": "high|medium|low"
  }
]

REGLAS DE URL:
- URLs deben terminar en .xml, .rss O contener /feed/ o /rss/
- Si no conoces la URL exacta del RSS, PREDICE basándote en patrones comunes:
  - https://[dominio]/rss/
  - https://[dominio]/feed/
  - https://[dominio]/rss/portada.xml
- Si un medio no tiene RSS conocido, OMÍTELO (no devuelvas URLs inventadas sin base)

CRITERIOS DE RELIABILITY:
- "high": Periódicos digitales consolidados (>10 años), grupo editorial conocido
- "medium": Medios regionales con presencia digital verificada (5-10 años)
- "low": Portales locales pequeños, blogs de noticias comunitarios

IMPORTANTE:
- Devolver SOLO el array JSON, SIN markdown (\`\`\`json), SIN explicaciones
- Máximo 5 fuentes
- Si no existen 5 medios fiables para ${city}, devuelve menos (mínimo 2)`;
}

