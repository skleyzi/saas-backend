/*
  Warnings:

  - Added the required column `interval` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceInCents` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN     "interval" "BillingInterval" NOT NULL,
ADD COLUMN     "priceInCents" INTEGER NOT NULL;
