-- CreateEnum
CREATE TYPE "ClassificationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "classification_reason" TEXT,
ADD COLUMN     "classification_status" "ClassificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "classified_at" TIMESTAMP(3),
ADD COLUMN     "is_political" BOOLEAN;
