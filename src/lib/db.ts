import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean | undefined;
};

const INIT_SQL = `
DO $$ BEGIN
    CREATE TYPE "InventoryStatus" AS ENUM (
      'AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'INSTALLED', 'ON_LOAN',
      'RETURN_IN_TRANSIT', 'UNDER_INSPECTION', 'DEFECTIVE_PENDING_RETURN',
      'DEFECTIVE_RETURNED_TO_VENDOR', 'SCRAPPED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "SparePartRequestStatus" AS ENUM (
      'REQUESTED', 'ALLOCATED', 'DISPATCHED', 'INSTALLED',
      'ON_LOAN', 'RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "partnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "category" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isLoaner" BOOLEAN NOT NULL DEFAULT false,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketSparePart" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER,
    "requestedPartName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "SparePartRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "isLoaner" BOOLEAN NOT NULL DEFAULT false,
    "expectedReturnDate" TIMESTAMP(3),
    "loanDurationDays" INTEGER DEFAULT 14,
    "returnInitiatedAt" TIMESTAMP(3),
    "returnCourierName" TEXT,
    "returnTrackingNo" TEXT,
    "returnReceivedAt" TIMESTAMP(3),
    "returnCondition" TEXT,
    "loanNotes" TEXT,
    "courierName" TEXT,
    "dispatchTrackingNo" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "replacedDefectiveSerial" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketSparePart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryLog" (
    "id" SERIAL NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "author" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isLoaner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "isLoaner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "expectedReturnDate" TIMESTAMP(3);
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "loanDurationDays" INTEGER DEFAULT 14;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnInitiatedAt" TIMESTAMP(3);
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnCourierName" TEXT;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnTrackingNo" TEXT;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnReceivedAt" TIMESTAMP(3);
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnCondition" TEXT;
ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "loanNotes" TEXT;

CREATE TABLE IF NOT EXISTS "SmtpConfig" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 465,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT 'TicketLink Support',
    "fromEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmtpConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" SERIAL NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "placeholders" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "ServicePartner" ADD COLUMN IF NOT EXISTS "dispatchEmail" TEXT;
ALTER TABLE "SmtpConfig" ADD COLUMN IF NOT EXISTS "adminCc" TEXT;

DO $$ BEGIN
    ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_eventKey_key" UNIQUE ("eventKey");
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_token_key" UNIQUE ("token");
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_serialNumber_key" UNIQUE ("serialNumber");
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;
`;

function getPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  // Self-heal/migrate missing tables automatically on startup
  if (!globalForPrisma.dbInitialized) {
    globalForPrisma.dbInitialized = true;
    pool.query(INIT_SQL).catch((err) => {
      console.warn("Auto-migration notice:", err.message);
    });
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

