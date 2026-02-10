-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';
