/*
  Warnings:

  - Added the required column `stripeProductId` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Plan_name_key";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "intervalCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stripeProductId" TEXT NOT NULL;
