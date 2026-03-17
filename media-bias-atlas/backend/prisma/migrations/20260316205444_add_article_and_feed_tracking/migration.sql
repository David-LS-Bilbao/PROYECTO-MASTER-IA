-- AlterTable
ALTER TABLE "rss_feeds" ADD COLUMN     "last_checked_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_url_key" ON "articles"("url");

-- CreateIndex
CREATE INDEX "articles_feed_id_idx" ON "articles"("feed_id");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "rss_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
