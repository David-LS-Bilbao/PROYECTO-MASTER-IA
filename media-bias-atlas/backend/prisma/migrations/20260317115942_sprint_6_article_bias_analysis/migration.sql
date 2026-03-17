-- CreateEnum
CREATE TYPE "BiasAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdeologyLabel" AS ENUM ('LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT', 'UNCLEAR');

-- CreateTable
CREATE TABLE "article_bias_analysis" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "status" "BiasAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "ideology_label" "IdeologyLabel",
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "reasoning_short" TEXT,
    "raw_json" TEXT,
    "error_message" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_bias_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_bias_analysis_article_id_key" ON "article_bias_analysis"("article_id");

-- AddForeignKey
ALTER TABLE "article_bias_analysis" ADD CONSTRAINT "article_bias_analysis_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
