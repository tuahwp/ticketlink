-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'MODERATOR', 'AGENT', 'FIELD_ENGINEER');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "serviceReportUrl" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FIELD_ENGINEER',
    "partnerId" INTEGER,
    "engineerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_engineerId_key" ON "User"("engineerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ServicePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "FieldEngineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
