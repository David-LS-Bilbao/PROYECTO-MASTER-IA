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

Tarea: Listar periódicos LOCALES/REGIONALES de "${location}" (España) con sus feeds RSS públicos.

Requisitos CRÍTICOS:
1. Solo periódicos LOCALES/REGIONALES (NO nacionales como El País, El Mundo, ABC, La Razón...)
2. Solo incluir si el feed RSS está VERIFICADO y público
3. Máximo ${limit} periódicos
4. Priorizar periódicos activos y relevantes

Formato JSON (OBLIGATORIO):
{
  "sources": [
    {
      "name": "Nombre exacto del periódico",
      "url": "https://sitio-web-oficial.com",
      "rssUrl": "https://sitio-web-oficial.com/rss/feed.xml",
      "region": "${location}",
      "verified": true
    }
  ]
}

IMPORTANTE:
- NO incluyas periódicos nacionales
- NO inventes URLs de RSS si no las conoces verificadas
- Si no conoces suficientes fuentes verificadas, devuelve menos de ${limit}`;
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

      // Validate and filter sources
      return parsed.sources
        .filter((src: any) => {
          return (
            src &&
            typeof src.name === 'string' &&
            typeof src.url === 'string' &&
            typeof src.rssUrl === 'string' &&
            src.verified === true
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
