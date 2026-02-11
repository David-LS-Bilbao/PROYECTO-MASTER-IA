/**
 * PgVectorClient Implementation (Infrastructure Layer)
 * Vector database client using pgvector extension in PostgreSQL
 * Replaces ChromaDB for semantic search
 */

import { PrismaClient } from '@prisma/client';
import { IVectorClient, ArticleVectorMetadata, QueryResult } from '../../domain/services/vector-client.interface';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';

/**
 * PgVectorClient uses PostgreSQL's pgvector extension for vector similarity search
 * - Cosine distance operator: <=>
 * - Embeddings stored directly in Article table
 * - No separate vector store needed (consolidated in main DB)
 */
export class PgVectorClient implements IVectorClient {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize pgvector extension (should be done via migration)
   * This method verifies the extension is enabled
   */
  async initCollection(): Promise<boolean> {
    try {
      // Verify pgvector extension is enabled
      const result = await this.prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'vector';
      `;

      if (result.length === 0) {
        throw new ConfigurationError(
          'pgvector extension not enabled. Run migration to enable it.'
        );
      }

      // Count articles with embeddings
      const count = await this.prisma.article.count({
        where: { embedding: { not: null } },
      });

      console.log(`[PgVectorClient] pgvector extension ready. Articles with embeddings: ${count}`);
      return true;
    } catch (error) {
      const err = error as Error;
      console.error(`[PgVectorClient] Error initializing: ${err.message}`);

      throw new ExternalAPIError(
        'PostgreSQL',
        `Failed to initialize pgvector: ${err.message}`,
        500,
        err
      );
    }
  }

  /**
   * Check if PostgreSQL is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      const err = error as Error;
      console.error(`[PgVectorClient] Health check failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Upsert an article's embedding into PostgreSQL
   * Updates existing article's embedding field
   */
  async upsertItem(
    id: string,
    embedding: number[],
    _metadata: ArticleVectorMetadata,
    _document: string
  ): Promise<void> {
    try {
      // Convert embedding array to pgvector format string
      const vectorString = `[${embedding.join(',')}]`;

      // Update article with embedding using raw SQL for pgvector compatibility
      await this.prisma.$executeRaw`
        UPDATE articles
        SET embedding = ${vectorString}::vector
        WHERE id = ${id}
      `;

      console.log(`[PgVectorClient] Embedding updated for article: ${id.substring(0, 8)}...`);
    } catch (error) {
      const err = error as Error;
      console.error(`[PgVectorClient] Error upserting embedding: ${err.message}`);

      throw new ExternalAPIError(
        'PostgreSQL',
        `Failed to upsert embedding: ${err.message}`,
        500,
        err
      );
    }
  }

  /**
   * Query similar documents using cosine distance
   * Returns article IDs ordered by similarity (smallest distance = most similar)
   */
  async querySimilar(queryVector: number[], limit: number = 10): Promise<string[]> {
    try {
      const vectorString = `[${queryVector.join(',')}]`;

      // Use cosine distance operator (<=>) for similarity search
      // Order by distance ASC (smallest distance = most similar)
      const results = await this.prisma.$queryRaw<Array<{ id: string; distance: number }>>`
        SELECT id, embedding <=> ${vectorString}::vector AS distance
        FROM articles
        WHERE embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      const ids = results.map(r => r.id);
      console.log(`[PgVectorClient] Found ${ids.length} similar articles`);

      return ids;
    } catch (error) {
      const err = error as Error;
      console.error(`[PgVectorClient] Error querying similar: ${err.message}`);

      throw new ExternalAPIError(
        'PostgreSQL',
        `Failed to query similar items: ${err.message}`,
        500,
        err
      );
    }
  }

  /**
   * Query similar documents and return full results with content
   * Used for RAG (Retrieval-Augmented Generation)
   */
  async querySimilarWithDocuments(queryVector: number[], limit: number = 5): Promise<QueryResult[]> {
    try {
      const vectorString = `[${queryVector.join(',')}]`;

      // Fetch articles with content, metadata, and distance
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          content: string;
          source: string;
          publishedAt: Date;
          biasScore: number | null;
          distance: number;
        }>
      >`
        SELECT
          id,
          title,
          content,
          source,
          "publishedAt",
          "biasScore",
          embedding <=> ${vectorString}::vector AS distance
        FROM articles
        WHERE embedding IS NOT NULL AND content IS NOT NULL
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      const queryResults: QueryResult[] = results.map(row => ({
        id: row.id,
        document: row.content || '',
        metadata: {
          title: row.title,
          source: row.source,
          publishedAt: row.publishedAt.toISOString(),
          biasScore: row.biasScore ?? undefined,
        },
        distance: row.distance,
      }));

      console.log(`[PgVectorClient] RAG Query - Found ${queryResults.length} articles with content`);

      return queryResults;
    } catch (error) {
      const err = error as Error;
      console.error(`[PgVectorClient] Error querying with documents: ${err.message}`);

      throw new ExternalAPIError(
        'PostgreSQL',
        `Failed to query with documents: ${err.message}`,
        500,
        err
      );
    }
  }
}
