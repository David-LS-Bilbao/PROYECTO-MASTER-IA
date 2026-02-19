/**
 * Discover Local Sources Use Case (Application Layer)
 *
 * FEATURE: RSS AUTO-DISCOVERY LOCAL (Sprint 32)
 * Descubre periódicos locales/regionales con Gemini AI + Caché
 */

import { IGeminiClient } from '../../domain/services/gemini-client.interface';

export interface DiscoverLocalSourcesParams {
  location: string;
  limit: number;
}

export interface DiscoveredSource {
  name: string;
  url: string;
  rssUrl: string;
  region: string;
  verified: boolean;
}

export interface DiscoverLocalSourcesResult {
  sources: DiscoveredSource[];
  fromCache: boolean;
  location: string;
}

// Cache en memoria: Map<location, { sources, cachedAt }>
const discoveryCache = new Map<
  string,
  { sources: DiscoveredSource[]; cachedAt: number }
>();

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export class DiscoverLocalSourcesUseCase {
  constructor(private readonly geminiClient: IGeminiClient) {}

  async execute(
    params: DiscoverLocalSourcesParams
  ): Promise<DiscoverLocalSourcesResult> {
    const { location, limit } = params;
    const cacheKey = location.toLowerCase().trim();

    // 1. Check cache first
    const cached = discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`✅ Cache HIT para ubicación: ${location}`);
      return {
        sources: cached.sources,
        fromCache: true,
        location,
      };
    }

    console.log(`🔄 Cache MISS para ubicación: ${location}, llamando a Gemini...`);

    // 2. Call Gemini with optimized prompt
    const systemPrompt = this.buildDiscoveryPrompt(location, limit);
    const messages = [
      {
        role: 'user' as const,
        content: `Descubre periódicos locales de ${location}`,
      },
    ];
    const response = await this.geminiClient.generateGeneralResponse(
      systemPrompt,
      messages
    );

    // 3. Parse response
    const sources = this.parseGeminiResponse(response, location);

    // 4. Cache the result
    discoveryCache.set(cacheKey, {
      sources,
      cachedAt: Date.now(),
    });

    console.log(`💾 Cached ${sources.length} fuentes para ${location}`);

    return {
      sources,
      fromCache: false,
      location,
    };
  }

  private buildDiscoveryPrompt(location: string, limit: number): string {
    return `Actúa como un experto en medios de comunicación españoles.

Tarea: Listar medios de comunicación que cubren noticias de "${location}" (España), incluyendo sus feeds RSS.

Prioridad de fuentes (en orden):
1. Periódicos estrictamente locales/municipales de ${location}
2. Periódicos provinciales/regionales que cubren ${location}
3. Ediciones regionales de medios nacionales con cobertura de ${location}

Requisitos:
- Máximo ${limit} fuentes
- Ordenar de más local a más regional
- Si ${location} es una ciudad pequeña, incluir los periódicos de la provincia/comunidad autónoma que la cubren
- Las URLs de RSS deben ser rutas habituales (ej: /feed, /rss, /rss.xml, /rss/portada)

Formato JSON (OBLIGATORIO):
{
  "sources": [
    {
      "name": "Nombre exacto del medio",
      "url": "https://sitio-web-oficial.com",
      "rssUrl": "https://sitio-web-oficial.com/rss/feed.xml",
      "region": "${location}",
      "verified": true
    }
  ]
}

IMPORTANTE:
- No inventes URLs de RSS si no las conoces; usa las rutas más probables (/feed, /rss, /rss.xml)
- Incluye medios aunque no sean estrictamente municipales si cubren la zona
- Si no encuentras fuentes para la ciudad, devuelve fuentes de la provincia/comunidad que la cubren
- Marca verified:true solo si conoces el feed, verified:false si es una estimación razonable`;
  }

  private parseGeminiResponse(
    response: string,
    location: string
  ): DiscoveredSource[] {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonString);

      if (!parsed.sources || !Array.isArray(parsed.sources)) {
        console.warn('⚠️ Gemini response missing sources array');
        return [];
      }

      // Validate and filter sources (allow verified:false too - URLs can still be tested)
      return parsed.sources
        .filter((src: any) => {
          return (
            src &&
            typeof src.name === 'string' &&
            src.name.length > 0 &&
            typeof src.url === 'string' &&
            src.url.startsWith('http') &&
            typeof src.rssUrl === 'string' &&
            src.rssUrl.startsWith('http')
          );
        })
        .map((src: any) => ({
          name: src.name,
          url: src.url,
          rssUrl: src.rssUrl,
          region: src.region || location,
          verified: src.verified,
        }));
    } catch (error) {
      console.error('❌ Error parsing Gemini response:', error);
      console.error('Raw response:', response);
      return [];
    }
  }

  /**
   * Get cache statistics (for admin/debugging)
   */
  static getCacheStats() {
    return {
      size: discoveryCache.size,
      locations: Array.from(discoveryCache.keys()),
    };
  }

  /**
   * Clear cache (for admin/debugging)
   */
  static clearCache() {
    const prevSize = discoveryCache.size;
    discoveryCache.clear();
    console.log(`🗑️ Cache cleared (${prevSize} entries removed)`);
  }
}
