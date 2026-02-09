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
import Parser from 'rss-parser';
import { GeminiClient } from '../../infrastructure/external/gemini.client';

/**
 * Source suggestion from AI
 */
interface AISourceSuggestion {
  name: string;
  url: string;
  reliability: 'high' | 'medium' | 'low';
}

/**
 * Validation result for an RSS feed
 */
interface ValidationResult {
  url: string;
  isValid: boolean;
  error?: string;
}

export class LocalSourceDiscoveryService {
  private readonly rssParser: Parser;
  private readonly VALIDATION_TIMEOUT = 5000; // 5 seconds

  constructor(
    private readonly prisma: PrismaClient,
    private readonly geminiClient: GeminiClient
  ) {
    this.rssParser = new Parser({
      timeout: this.VALIDATION_TIMEOUT,
    });
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

      // Validate structure
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('AI returned empty or invalid array');
      }

      for (const suggestion of suggestions) {
        if (!suggestion.name || !suggestion.url || !suggestion.reliability) {
          throw new Error(`Invalid suggestion structure: ${JSON.stringify(suggestion)}`);
        }
      }
    } catch (error) {
      console.error(`❌ [LocalSourceDiscovery] Failed to parse AI response:`, error);
      console.error(`   → Raw response: ${aiResponse.substring(0, 500)}...`);
      throw new Error(`Invalid JSON from AI: ${(error as Error).message}`);
    }

    // =====================================================================
    // STEP 4: VALIDATION LOOP - Test each RSS feed URL
    // =====================================================================
    console.log(`\n🔬 [LocalSourceDiscovery] Validating ${suggestions.length} suggested sources...`);

    const validationResults: ValidationResult[] = [];

    for (const suggestion of suggestions) {
      const result = await this.validateRssFeed(suggestion.url, suggestion.name);
      validationResults.push(result);

      if (result.isValid) {
        console.log(`   ✅ "${suggestion.name}": Valid (${suggestion.url.substring(0, 60)}...)`);
      } else {
        console.log(`   ❌ "${suggestion.name}": Dead Link (${result.error})`);
      }
    }

    const validSources = suggestions.filter((_, index) => validationResults[index].isValid);
    const deadLinks = suggestions.length - validSources.length;

    console.log(`\n📊 [LocalSourceDiscovery] Validation results:`);
    console.log(`   → AI suggested: ${suggestions.length} sources`);
    console.log(`   → Valid RSS feeds: ${validSources.length}`);
    console.log(`   → Dead links (skipped): ${deadLinks}`);

    if (validSources.length === 0) {
      console.warn(`⚠️ [LocalSourceDiscovery] No valid sources found for "${city}"`);
      return;
    }

    // =====================================================================
    // STEP 5: Save valid sources to database (UPSERT to avoid duplicates)
    // =====================================================================
    console.log(`\n💾 [LocalSourceDiscovery] Saving ${validSources.length} valid sources to database...`);

    let savedCount = 0;
    let skippedCount = 0;

    for (const source of validSources) {
      try {
        await this.prisma.source.upsert({
          where: { url: source.url },
          update: {
            // If source exists, update metadata
            location: city,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            name: source.name,
            url: source.url,
            category: 'local',
            location: city,
            reliability: source.reliability,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        savedCount++;
        console.log(`   ✅ Saved: "${source.name}"`);
      } catch (error) {
        console.error(`   ❌ Failed to save "${source.name}":`, error);
        skippedCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ [LocalSourceDiscovery] Discovery completed for "${city}"`);
    console.log(`   → AI suggested: ${suggestions.length} sources`);
    console.log(`   → Valid feeds: ${validSources.length}`);
    console.log(`   → Saved to DB: ${savedCount}`);
    console.log(`   → Errors: ${skippedCount}`);
    console.log(`========================================\n`);
  }

  /**
   * Validate an RSS feed URL
   *
   * Attempts to fetch and parse the RSS feed with a 5-second timeout.
   * Returns validation result with error details if invalid.
   *
   * @param url - RSS feed URL to validate
   * @param _name - Source name (for logging - unused but kept for clarity)
   * @returns Validation result
   */
  private async validateRssFeed(url: string, _name: string): Promise<ValidationResult> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), this.VALIDATION_TIMEOUT);
      });

      // Race between fetch and timeout
      await Promise.race([
        this.rssParser.parseURL(url),
        timeoutPromise,
      ]);

      return {
        url,
        isValid: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Categorize error types
      let friendlyError = errorMessage;
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        friendlyError = '404 Not Found';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        friendlyError = 'Timeout (5s)';
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        friendlyError = 'Domain not found';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        friendlyError = '403 Forbidden';
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        friendlyError = '500 Server Error';
      }

      return {
        url,
        isValid: false,
        error: friendlyError,
      };
    }
  }
}
