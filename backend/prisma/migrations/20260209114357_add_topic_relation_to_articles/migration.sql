-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "topicId" TEXT;

-- CreateIndex
CREATE INDEX "articles_topicId_idx" ON "articles"("topicId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
