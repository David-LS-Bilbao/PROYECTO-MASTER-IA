/**
 * Discover Local Sources Use Case (Application Layer)
 *
 * FEATURE: RSS AUTO-DISCOVERY LOCAL (Sprint 32)
 * Descubre periodicos locales/regionales con Gemini AI + Cache
 */

import {
  AIObservabilityContext,
  IGeminiClient,
} from '../../domain/services/gemini-client.interface';

export interface DiscoverLocalSourcesParams {
  location: string;
  limit: number;
  observabilityContext?: AIObservabilityContext;
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

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const LOCAL_DISCOVERY_OPERATION_KEY = 'local_source_discovery';
const LOCAL_DISCOVERY_PROMPT_KEY = 'LOCAL_SOURCES_DISCOVERY_PROMPT';
const LOCAL_DISCOVERY_PROMPT_VERSION = '1.0.0';
const LOCAL_DISCOVERY_PROMPT_SOURCE_FILE =
  'backend/src/application/use-cases/discover-local-sources.usecase.ts';

export class DiscoverLocalSourcesUseCase {
  constructor(private readonly geminiClient: IGeminiClient) {}

  async execute(
    params: DiscoverLocalSourcesParams
  ): Promise<DiscoverLocalSourcesResult> {
    const { location, limit, observabilityContext } = params;
    const cacheKey = location.toLowerCase().trim();

    // 1. Check cache first
    const cached = discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`✅ Cache HIT para ubicacion: ${location}`);
      return {
        sources: cached.sources,
        fromCache: true,
        location,
      };
    }

    console.log(`🔄 Cache MISS para ubicacion: ${location}, llamando a Gemini...`);

    // 2. Call Gemini with optimized prompt
    const systemPrompt = this.buildDiscoveryPrompt(location, limit);
    const messages = [
      {
        role: 'user' as const,
        content: `Descubre periodicos locales de ${location}`,
      },
    ];
    const response = await this.geminiClient.generateGeneralResponse(
      systemPrompt,
      messages,
      {
        ...observabilityContext,
        operationKey:
          observabilityContext?.operationKey ?? LOCAL_DISCOVERY_OPERATION_KEY,
        promptKey: observabilityContext?.promptKey ?? LOCAL_DISCOVERY_PROMPT_KEY,
        promptVersion:
          observabilityContext?.promptVersion ?? LOCAL_DISCOVERY_PROMPT_VERSION,
        promptTemplate:
          observabilityContext?.promptTemplate ??
          this.buildDiscoveryPromptTemplate(),
        promptSourceFile:
          observabilityContext?.promptSourceFile ??
          LOCAL_DISCOVERY_PROMPT_SOURCE_FILE,
        metadata: {
          ...observabilityContext?.metadata,
          locationLength: location.length,
          limit,
          cacheHit: false,
        },
      }
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
    return this.buildDiscoveryPromptTemplate()
      .replaceAll('{location}', location)
      .replace('{limit}', String(limit));
  }

  private buildDiscoveryPromptTemplate(): string {
    return `Actua como un experto en medios de comunicacion espanoles.

Tarea: Listar medios de comunicacion que cubren noticias de "{location}" (Espana), incluyendo sus feeds RSS.

Prioridad de fuentes (en orden):
1. Periodicos estrictamente locales/municipales de {location}
2. Periodicos provinciales/regionales que cubren {location}
3. Ediciones regionales de medios nacionales con cobertura de {location}

Requisitos:
- Maximo {limit} fuentes
- Ordenar de mas local a mas regional
- Si {location} es una ciudad pequena, incluir los periodicos de la provincia/comunidad autonoma que la cubren
- Las URLs de RSS deben ser rutas habituales (ej: /feed, /rss, /rss.xml, /rss/portada)

Formato JSON (OBLIGATORIO):
{
  "sources": [
    {
      "name": "Nombre exacto del medio",
      "url": "https://sitio-web-oficial.com",
      "rssUrl": "https://sitio-web-oficial.com/rss/feed.xml",
      "region": "{location}",
      "verified": true
    }
  ]
}

IMPORTANTE:
- No inventes URLs de RSS si no las conoces; usa las rutas mas probables (/feed, /rss, /rss.xml)
- Incluye medios aunque no sean estrictamente municipales si cubren la zona
- Si no encuentras fuentes para la ciudad, devuelve fuentes de la provincia/comunidad que la cubren
- Marca verified:true solo si conoces el feed, verified:false si es una estimacion razonable`;
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
