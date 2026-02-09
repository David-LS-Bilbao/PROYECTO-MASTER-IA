/**
 * Local Source Discovery Service (Application Layer)
 * Sprint 24: AI-powered discovery of local news sources
 *
 * Orchestrates the discovery of local news RSS feeds using Gemini AI:
 * 1. Checks if sources already exist in DB (avoid redundant AI calls)
 * 2. Asks Gemini to identify the 5 most important local news sources for a city
 * 3. Validates suggested RSS feed URLs (dead link detection)
 * 4. Saves valid sources to the database
 *
 * @module application/services/local-source-discovery
 */

import { PrismaClient } from '@prisma/client';
import { GeminiClient } from '../../infrastructure/external/gemini.client';

/**
 * Source suggestion from AI (Sprint 24.1 refactored)
 * Now returns domain + media_group instead of RSS URL to reduce hallucinations
 */
interface AISourceSuggestion {
  name: string;
  domain: string; // Homepage URL (e.g., "https://www.levante-emv.com")
  media_group: string; // Editorial group (e.g., "Prensa Ibérica", "Independent")
  reliability: 'high' | 'medium' | 'low';
}

/**
 * Sprint 24.2: Common RSS feed path patterns used by Spanish news sites
 * Ordered by frequency (most common first)
 */
const COMMON_RSS_PATHS = [
  '/rss',
  '/feed',
  '/rss.xml',
  '/feed.xml',
  '/rss/portada',           // Common in custom CMS
  '/rss/atom/portada',      // Vocento pattern
  '/rss/section/portada',   // Prensa Ibérica pattern
  '/feeds/rss',
  '/rss/noticias',
  '/atom.xml',
];

export class LocalSourceDiscoveryService {
  private readonly PROBE_TIMEOUT = 3000; // 3 seconds per probe

  constructor(
    private readonly prisma: PrismaClient,
    private readonly geminiClient: GeminiClient
  ) {
    // Sprint 24.2: RSS Smart Probing - discovers real RSS feeds from homepage domains
  }

  /**
   * Discover and save local news sources for a city using AI
   *
   * @param city - City name (e.g., "Bilbao", "Valencia")
   */
  async discoverAndSave(city: string): Promise<void> {
    console.log(`\n========================================`);
    console.log(`🔍 [LocalSourceDiscovery] Starting discovery for: "${city}"`);
    console.log(`========================================`);

    // =====================================================================
    // STEP 1: Check if sources already exist in DB
    // =====================================================================
    const existingSources = await this.prisma.source.findMany({
      where: { location: city },
    });

    if (existingSources.length > 0) {
      console.log(`💾 [LocalSourceDiscovery] Found ${existingSources.length} existing sources for "${city}"`);
      console.log(`   → Skipping AI discovery to save tokens`);
      console.log(`   → Sources: ${existingSources.map((s: { name: string }) => s.name).join(', ')}`);
      return;
    }

    console.log(`📭 [LocalSourceDiscovery] No existing sources for "${city}" - triggering AI discovery`);

    // =====================================================================
    // STEP 2: Ask Gemini AI for local source suggestions
    // =====================================================================
    console.log(`🤖 [LocalSourceDiscovery] Asking Gemini for local sources...`);

    let aiResponse: string;
    try {
      aiResponse = await this.geminiClient.discoverLocalSources(city);
      console.log(`✅ [LocalSourceDiscovery] Gemini response received (${aiResponse.length} chars)`);
    } catch (error) {
      console.error(`❌ [LocalSourceDiscovery] Gemini API error:`, error);
      throw new Error(`Failed to query Gemini for local sources: ${(error as Error).message}`);
    }

    // =====================================================================
    // STEP 3: Parse JSON response (handle markdown backticks)
    // =====================================================================
    let suggestions: AISourceSuggestion[];
    try {
      // Clean potential markdown code blocks
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
      }

      suggestions = JSON.parse(cleanedResponse) as AISourceSuggestion[];
      console.log(`📋 [LocalSourceDiscovery] Parsed ${suggestions.length} source suggestions`);

      // Validate structure (Sprint 24.1: now checks domain + media_group)
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        console.warn(`⚠️ [LocalSourceDiscovery] AI returned empty array for "${city}"`);
        return; // No sources found, exit gracefully
      }

      for (const suggestion of suggestions) {
        if (!suggestion.name || !suggestion.domain || !suggestion.reliability) {
          throw new Error(`Invalid suggestion structure: ${JSON.stringify(suggestion)}`);
        }
      }
    } catch (error) {
      console.error(`❌ [LocalSourceDiscovery] Failed to parse AI response:`, error);
      console.error(`   → Raw response: ${aiResponse.substring(0, 500)}...`);
      throw new Error(`Invalid JSON from AI: ${(error as Error).message}`);
    }

    // =====================================================================
    // STEP 4: RSS Smart Probing + Save to database
    // =====================================================================
    // Sprint 24.2: For each domain, try to discover the real RSS feed URL
    // by testing common RSS path patterns. If found, store the RSS URL;
    // otherwise, store the homepage domain as fallback.
    console.log(`\n🔍 [LocalSourceDiscovery] Probing RSS feeds for ${suggestions.length} sources...`);

    let savedCount = 0;
    let skippedCount = 0;
    let rssFoundCount = 0;

    for (const source of suggestions) {
      try {
        // Probe for RSS feed
        console.log(`   🔎 Probing "${source.name}" at ${source.domain}...`);
        const rssUrl = await this.probeRssUrl(source.domain);

        if (rssUrl) {
          console.log(`      ✅ Found valid RSS: ${rssUrl}`);
          rssFoundCount++;
        } else {
          console.log(`      ⚠️ No RSS found, using homepage as fallback`);
        }

        // Save to database (use RSS URL if found, otherwise homepage domain)
        const urlToSave = rssUrl || source.domain;

        await this.prisma.source.upsert({
          where: { url: urlToSave },
          update: {
            // If source exists, update metadata
            location: city,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            name: source.name,
            url: urlToSave, // RSS URL if found, otherwise homepage domain
            category: 'local',
            location: city,
            reliability: source.reliability,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        savedCount++;
      } catch (error) {
        console.error(`   ❌ Failed to process "${source.name}":`, error);
        skippedCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ [LocalSourceDiscovery] Discovery completed for "${city}"`);
    console.log(`   → AI suggested: ${suggestions.length} sources`);
    console.log(`   → RSS feeds discovered: ${rssFoundCount}/${suggestions.length}`);
    console.log(`   → Saved to DB: ${savedCount}`);
    console.log(`   → Errors: ${skippedCount}`);
    if (savedCount > 0) {
      console.log(`   📰 Sources: ${suggestions.slice(0, 3).map((s: AISourceSuggestion) => s.name).join(', ')}${suggestions.length > 3 ? '...' : ''}`);
    }
    console.log(`========================================\n`);
  }

  /**
   * Sprint 24.2: RSS Smart Probing
   *
   * Discovers the real RSS feed URL from a homepage domain by testing
   * common RSS path patterns used by Spanish news sites.
   *
   * Strategy:
   * 1. Try common RSS paths in order of frequency
   * 2. Perform lightweight HEAD requests (3s timeout)
   * 3. Check for 200 status + xml/rss content-type
   * 4. Return first valid URL found, or null if all fail
   *
   * @param domain - Homepage URL (e.g., "https://www.levante-emv.com")
   * @returns Valid RSS feed URL, or null if not found
   */
  private async probeRssUrl(domain: string): Promise<string | null> {
    // Normalize domain: remove trailing slash
    const baseDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;

    for (const path of COMMON_RSS_PATHS) {
      const candidateUrl = `${baseDomain}${path}`;

      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.PROBE_TIMEOUT);

        // Perform HEAD request (lightweight, no body download)
        const response = await fetch(candidateUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VerityNewsBot/1.0)',
          },
        });

        clearTimeout(timeoutId);

        // Check if response is valid RSS feed
        const contentType = response.headers.get('content-type') || '';
        const isRss = contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');

        if (response.ok && isRss) {
          return candidateUrl; // Winner!
        }
      } catch (error) {
        // Timeout or network error - continue to next pattern
        continue;
      }
    }

    return null; // No valid RSS feed found
  }
}
