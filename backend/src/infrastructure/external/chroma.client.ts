/**
 * ChromaClient Implementation (Infrastructure Layer)
 * Vector database client for semantic search with ChromaDB
 */

import { ChromaClient as ChromaSDK, Collection } from 'chromadb';
import { IChromaClient, ArticleVectorMetadata } from '../../domain/services/chroma-client.interface';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';

// Collection name constant
const COLLECTION_NAME = 'verity-news-articles';

export class ChromaClient implements IChromaClient {
  private readonly client: ChromaSDK;
  private collection: Collection | null = null;
  private readonly url: string;

  constructor(url?: string) {
    this.url = url || process.env.CHROMA_DB_URL || 'http://localhost:8000';

    if (!this.url) {
      throw new ConfigurationError('CHROMA_DB_URL is required');
    }

    this.client = new ChromaSDK({
      path: this.url,
    });

    console.log(`[ChromaClient] Configurado para conectar a: ${this.url}`);
  }

  /**
   * Initialize the collection, creating it if it doesn't exist
   * Uses cosine distance for similarity search optimization
   */
  async initCollection(): Promise<boolean> {
    try {
      console.log(`[ChromaClient] Inicializando colección: ${COLLECTION_NAME}...`);

      this.collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
      });

      const count = await this.collection.count();
      console.log(`[ChromaClient] Colección lista. Documentos actuales: ${count}`);

      return true;
    } catch (error) {
      const err = error as Error;
      console.error(`[ChromaClient] Error inicializando colección: ${err.message}`);

      throw new ExternalAPIError(
        'ChromaDB',
        `Failed to initialize collection: ${err.message}`,
        500,
        err
      );
    }
  }

  /**
   * Check if ChromaDB server is available via heartbeat
   */
  async healthCheck(): Promise<boolean> {
    try {
      const heartbeat = await this.client.heartbeat();
      console.log(`[ChromaClient] Heartbeat OK - nanoseconds: ${heartbeat}`);
      return true;
    } catch (error) {
      const err = error as Error;
      console.error(`[ChromaClient] Heartbeat FAILED: ${err.message}`);
      return false;
    }
  }

  /**
   * Get the collection instance (for use in other services)
   * @throws ExternalAPIError if collection not initialized
   */
  getCollection(): Collection {
    if (!this.collection) {
      throw new ExternalAPIError(
        'ChromaDB',
        'Collection not initialized. Call initCollection() first.',
        500
      );
    }
    return this.collection;
  }

  /**
   * Get collection name constant
   */
  static getCollectionName(): string {
    return COLLECTION_NAME;
  }

  /**
   * Upsert an article's embedding into the vector store
   * Uses upsert to handle both new inserts and updates
   */
  async upsertItem(
    id: string,
    embedding: number[],
    metadata: ArticleVectorMetadata,
    document: string
  ): Promise<void> {
    if (!this.collection) {
      throw new ExternalAPIError(
        'ChromaDB',
        'Collection not initialized. Call initCollection() first.',
        500
      );
    }

    try {
      console.log(`[ChromaClient] Upserting documento ID: ${id.substring(0, 8)}...`);

      await this.collection.upsert({
        ids: [id],
        embeddings: [embedding],
        metadatas: [{
          title: metadata.title,
          source: metadata.source,
          publishedAt: metadata.publishedAt,
          biasScore: metadata.biasScore ?? 0,
        }],
        documents: [document],
      });

      console.log(`[ChromaClient] Upsert OK para ID: ${id.substring(0, 8)}...`);
    } catch (error) {
      const err = error as Error;
      console.error(`[ChromaClient] Error en upsert: ${err.message}`);

      throw new ExternalAPIError(
        'ChromaDB',
        `Failed to upsert item: ${err.message}`,
        500,
        err
      );
    }
  }

  /**
   * Query similar documents by embedding vector
   * Returns article IDs ordered by similarity (most similar first)
   */
  async querySimilar(queryVector: number[], limit: number = 10): Promise<string[]> {
    if (!this.collection) {
      throw new ExternalAPIError(
        'ChromaDB',
        'Collection not initialized. Call initCollection() first.',
        500
      );
    }

    try {
      console.log(`[ChromaClient] Buscando ${limit} documentos similares...`);

      const results = await this.collection.query({
        queryEmbeddings: [queryVector],
        nResults: limit,
      });

      const ids = results.ids[0] || [];
      console.log(`[ChromaClient] Encontrados ${ids.length} documentos similares`);

      return ids;
    } catch (error) {
      const err = error as Error;
      console.error(`[ChromaClient] Error en query: ${err.message}`);

      throw new ExternalAPIError(
        'ChromaDB',
        `Failed to query similar items: ${err.message}`,
        500,
        err
      );
    }
  }
}
