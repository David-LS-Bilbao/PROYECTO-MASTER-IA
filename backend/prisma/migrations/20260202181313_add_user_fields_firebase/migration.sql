/*
  Warnings:

  - The primary key for the `favorites` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `favorites` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `firebaseUid` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `photoURL` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'QUOTA', 'PAY_AS_YOU_GO');

-- DropIndex
DROP INDEX "favorites_userId_articleId_key";

-- DropIndex
DROP INDEX "users_firebaseUid_key";

-- AlterTable
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId", "articleId");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "displayName",
DROP COLUMN "firebaseUid",
DROP COLUMN "photoURL",
ADD COLUMN     "name" TEXT,
ADD COLUMN     "picture" TEXT,
ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "usageStats" JSONB;
