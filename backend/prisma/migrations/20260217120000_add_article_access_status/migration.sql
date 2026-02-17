-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PUBLIC', 'PAYWALLED', 'RESTRICTED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "access_status" "AccessStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "access_reason" VARCHAR(180),
ADD COLUMN "analysis_blocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "articles_access_status_idx" ON "articles"("access_status");
CREATE INDEX "articles_analysis_blocked_idx" ON "articles"("analysis_blocked");
