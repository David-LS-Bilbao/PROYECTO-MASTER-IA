-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "analysis" TEXT,
ADD COLUMN     "analyzedAt" TIMESTAMP(3),
ADD COLUMN     "biasScore" DOUBLE PRECISION,
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "articles_analyzedAt_idx" ON "articles"("analyzedAt");
