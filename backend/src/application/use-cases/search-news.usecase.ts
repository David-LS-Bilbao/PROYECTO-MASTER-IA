/**
 * SearchNewsUseCase (Application Layer)
 * Semantic search using ChromaDB vector store + PostgreSQL for content
 * Pattern: Vector Search for IDs -> SQL fetch for Content
 */

import { NewsArticle } from '../../domain/entities/news-article.entity';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient } from '../../domain/services/gemini-client.interface';
import { IChromaClient } from '../../domain/services/chroma-client.interface';
import { ValidationError } from '../../domain/errors/domain.error';
import { GeminiErrorMapper } from '../../infrastructure/external/gemini-error-mapper';

export interface SearchNewsInput {
  query: string;
  limit?: number;
}

export interface SearchNewsOutput {
  query: string;
  results: NewsArticle[];
  totalFound: number;
}

export class SearchNewsUseCase {
  constructor(
    private readonly articleRepository: INewsArticleRepository,
    private readonly geminiClient: IGeminiClient,
    private readonly chromaClient: IChromaClient
  ) {}

  async execute(input: SearchNewsInput): Promise<SearchNewsOutput> {
    const { query, limit = 10 } = input;

    // Validate input
    if (!query || query.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    console.log(`\n🔍 [Search] Query: "${query}" (limit: ${limit})`);

    // 1. Generate embedding for the search query
    console.log(`   🧠 Generando embedding para la query...`);
    
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.geminiClient.generateEmbedding(query);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   ❌ Gemini embedding failed: ${mappedError.message}`);
      throw mappedError;
    }

    // 2. Search ChromaDB for similar article IDs
    console.log(`   🔗 Buscando en ChromaDB...`);
    const similarIds = await this.chromaClient.querySimilar(queryEmbedding, limit);

    if (similarIds.length === 0) {
      console.log(`   ⚠️ No se encontraron resultados similares`);
      return {
        query,
        results: [],
        totalFound: 0,
      };
    }

    console.log(`   ✅ Encontrados ${similarIds.length} IDs similares`);

    // 3. Fetch full articles from PostgreSQL
    console.log(`   📚 Recuperando artículos de PostgreSQL...`);
    const articles = await this.articleRepository.findByIds(similarIds);

    // 4. Preserve ChromaDB relevance order
    // PostgreSQL doesn't guarantee order, so we reorder based on ChromaDB results
    const orderedArticles = this.preserveRelevanceOrder(similarIds, articles);

    console.log(`   ✅ Devolviendo ${orderedArticles.length} artículos ordenados por relevancia`);

    return {
      query,
      results: orderedArticles,
      totalFound: orderedArticles.length,
    };
  }

  /**
   * Reorder articles to match the relevance order from ChromaDB
   * This ensures the most semantically similar articles appear first
   */
  private preserveRelevanceOrder(
    orderedIds: string[],
    articles: NewsArticle[]
  ): NewsArticle[] {
    const articleMap = new Map(articles.map((a) => [a.id, a]));

    return orderedIds
      .map((id) => articleMap.get(id))
      .filter((article): article is NewsArticle => article !== undefined);
  }
}
