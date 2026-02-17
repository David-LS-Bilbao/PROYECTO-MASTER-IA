-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the old embedding column (it was storing JSON strings)
ALTER TABLE "articles" DROP COLUMN IF EXISTS "embedding";

-- Add the new embedding column using pgvector type (768 dimensions for Gemini)
ALTER TABLE "articles" ADD COLUMN "embedding" vector(768);

-- Create an index for faster similarity searches using cosine distance
-- HNSW index is more efficient than IVFFlat for most use cases
CREATE INDEX IF NOT EXISTS "articles_embedding_idx" ON "articles"
USING hnsw ("embedding" vector_cosine_ops);
