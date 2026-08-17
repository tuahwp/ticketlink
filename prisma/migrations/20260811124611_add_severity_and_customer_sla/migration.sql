-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "severity" "Severity";

-- CreateTable
CREATE TABLE "CustomerSla" (
    "id" SERIAL NOT NULL,
    "customer" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "region" TEXT NOT NULL,
    "slaHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSla_customer_severity_region_key" ON "CustomerSla"("customer", "severity", "region");
