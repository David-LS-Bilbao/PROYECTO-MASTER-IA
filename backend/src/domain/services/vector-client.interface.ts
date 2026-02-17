/**
 * IVectorClient Interface (Domain Layer)
 * Generic contract for vector database operations - database agnostic
 * Replaces IChromaClient for pgvector migration
 */

export interface ArticleVectorMetadata {
  title: string;
  source: string;
  publishedAt: string;
  biasScore?: number;
}

/**
 * Result from a vector similarity query including document content
 */
export interface QueryResult {
  id: string;
  document: string;
  metadata: ArticleVectorMetadata;
  distance?: number;
}

export interface IVectorClient {
  /**
   * Initialize the vector store (create indexes, extensions, etc.)
   * @returns true if initialization is successful
   */
  initCollection(): Promise<boolean>;

  /**
   * Check if vector database is available
   * @returns true if database responds to health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Upsert an article's embedding into the vector store
   * @param id Unique article UUID
   * @param embedding Vector array from Gemini (768 dimensions)
   * @param metadata Article metadata for filtering
   * @param document Text content for retrieval
   */
  upsertItem(
    id: string,
    embedding: number[],
    metadata: ArticleVectorMetadata,
    document: string
  ): Promise<void>;

  /**
   * Query similar documents by embedding vector
   * @param queryVector The embedding vector to search with
   * @param limit Maximum number of results (default 10)
   * @returns Array of article IDs ordered by similarity (most similar first)
   */
  querySimilar(queryVector: number[], limit?: number): Promise<string[]>;

  /**
   * Query similar documents and return full results with document content
   * Used for RAG (Retrieval-Augmented Generation)
   * @param queryVector The embedding vector to search with
   * @param limit Maximum number of results (default 5)
   * @returns Array of QueryResult with documents and metadata
   */
  querySimilarWithDocuments(queryVector: number[], limit?: number): Promise<QueryResult[]>;
}
