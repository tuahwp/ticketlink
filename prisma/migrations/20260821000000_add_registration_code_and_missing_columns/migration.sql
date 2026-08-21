-- Add missing columns to User table (avatarUrl was added after last migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Add missing column to ServicePartner table (companyPhotoUrl was added after last migration)
ALTER TABLE "ServicePartner" ADD COLUMN IF NOT EXISTS "companyPhotoUrl" TEXT;

-- CreateTable: RegistrationCode
CREATE TABLE "RegistrationCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCode_code_key" ON "RegistrationCode"("code");

-- AddForeignKey
ALTER TABLE "RegistrationCode" ADD CONSTRAINT "RegistrationCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ServicePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
