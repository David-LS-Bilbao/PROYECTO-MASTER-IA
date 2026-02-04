/**
 * RSS Discovery Prompt Configuration
 * 
 * Usado para encontrar feeds RSS de medios de comunicación
 * Versión actual: v1 (formato simple de búsqueda)
 */

/**
 * Genera prompt para buscar feed RSS de un medio
 * 
 * @param mediaName - Nombre del medio de comunicación
 * @returns Prompt para enviar a Gemini
 */
export function buildRssDiscoveryPrompt(mediaName: string): string {
  return `El usuario busca el RSS de: '${mediaName}'. Devuelve EXCLUSIVAMENTE la URL del feed RSS oficial más probable. Sin texto, sin markdown, solo la URL. Si no tiene RSS o no lo sabes, devuelve 'null'.`;
}
