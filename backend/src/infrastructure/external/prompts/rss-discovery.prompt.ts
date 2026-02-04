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
