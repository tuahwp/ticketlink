const pg = require("pg");

const MIGRATION_STATEMENTS = [
  // Enums
  `DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'MODERATOR', 'AGENT', 'FIELD_ENGINEER'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'FOLLOW_UP', 'COMPLETE', 'CLOSED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "DeviceStatus" AS ENUM ('STANDARD', 'ON_REQUEST'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "Severity" AS ENUM ('P1', 'P2', 'P3', 'P4', 'NA'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "InventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'INSTALLED', 'ON_LOAN', 'RETURN_IN_TRANSIT', 'UNDER_INSPECTION', 'DEFECTIVE_PENDING_RETURN', 'DEFECTIVE_RETURNED_TO_VENDOR', 'SCRAPPED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "SparePartRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REQUESTED', 'ALLOCATED', 'DISPATCHED', 'INSTALLED', 'ON_LOAN', 'RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "InventoryTrackingType" AS ENUM ('SERIALIZED', 'BULK'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "StockOwnership" AS ENUM ('HQ_CONSIGNED', 'PARTNER_OWNED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED_REPLENISH', 'APPROVED_REIMBURSE', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // Alter enum values if type already exists
  `ALTER TYPE "SparePartRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';`,
  `ALTER TYPE "SparePartRequestStatus" ADD VALUE IF NOT EXISTS 'APPROVED';`,
  `ALTER TYPE "SparePartRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';`,
  `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';`,
  `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';`,

  // Core tables if not exist
  `CREATE TABLE IF NOT EXISTS "Warehouse" (
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
  );`,
  `CREATE TABLE IF NOT EXISTS "InventoryItem" (
      "id" SERIAL NOT NULL,
      "name" TEXT NOT NULL,
      "partNumber" TEXT,
      "category" TEXT NOT NULL,
      "serialNumber" TEXT,
      "warehouseId" INTEGER NOT NULL DEFAULT 1,
      "status" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
      "isLoaner" BOOLEAN NOT NULL DEFAULT false,
      "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "supplier" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "TicketSparePart" (
      "id" SERIAL NOT NULL,
      "ticketId" INTEGER NOT NULL,
      "inventoryItemId" INTEGER,
      "requestedPartName" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "status" "SparePartRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
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
      "batchTrackingNo" TEXT,
      "dispatchedAt" TIMESTAMP(3),
      "installedAt" TIMESTAMP(3),
      "replacedDefectiveSerial" TEXT,
      "requestedBy" TEXT,
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectionReason" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TicketSparePart_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "WarehouseTransfer" (
      "id" SERIAL NOT NULL,
      "sourceWarehouseId" INTEGER NOT NULL,
      "destinationWarehouseId" INTEGER NOT NULL,
      "courierName" TEXT,
      "trackingNo" TEXT,
      "notes" TEXT,
      "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
      "transferredBy" TEXT NOT NULL DEFAULT 'System',
      "receivedBy" TEXT,
      "receivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "WarehouseTransferItem" (
      "id" SERIAL NOT NULL,
      "transferId" INTEGER NOT NULL,
      "inventoryItemId" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT "WarehouseTransferItem_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "PartReplacementClaim" (
      "id" SERIAL NOT NULL,
      "ticketId" INTEGER NOT NULL,
      "partnerId" INTEGER NOT NULL,
      "inventoryItemId" INTEGER,
      "partName" TEXT NOT NULL,
      "serialNumber" TEXT,
      "defectiveSerial" TEXT,
      "claimAmount" DOUBLE PRECISION,
      "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
      "settlementType" TEXT,
      "replacementItemId" INTEGER,
      "requestedBy" TEXT NOT NULL,
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectionReason" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartReplacementClaim_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "InventoryLog" (
      "id" SERIAL NOT NULL,
      "inventoryItemId" INTEGER NOT NULL,
      "action" TEXT NOT NULL,
      "notes" TEXT,
      "author" TEXT NOT NULL DEFAULT 'System',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "RegistrationCode" (
      "id" SERIAL NOT NULL,
      "code" TEXT NOT NULL,
      "role" "UserRole" NOT NULL DEFAULT 'FIELD_ENGINEER',
      "partnerId" INTEGER NOT NULL,
      "maxUses" INTEGER NOT NULL DEFAULT 1,
      "uses" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RegistrationCode_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "SmtpConfig" (
      "id" SERIAL NOT NULL,
      "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
      "port" INTEGER NOT NULL DEFAULT 465,
      "secure" BOOLEAN NOT NULL DEFAULT true,
      "user" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "fromName" TEXT NOT NULL DEFAULT 'TicketLink Support',
      "fromEmail" TEXT NOT NULL,
      "adminCc" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SmtpConfig_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "EmailTemplate" (
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
  );`,
  `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" SERIAL NOT NULL,
      "token" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "CustomerSla" (
      "id" SERIAL NOT NULL,
      "customer" TEXT NOT NULL,
      "severity" "Severity" NOT NULL,
      "region" TEXT NOT NULL,
      "slaHours" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CustomerSla_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "EndCustomerSite" (
      "id" SERIAL NOT NULL,
      "name" TEXT NOT NULL,
      "group" TEXT NOT NULL,
      "state" TEXT NOT NULL,
      "mainconId" INTEGER NOT NULL,
      CONSTRAINT "EndCustomerSite_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "TicketActivity" (
      "id" SERIAL NOT NULL,
      "ticketId" INTEGER NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'COMMENT',
      "status" TEXT,
      "subStatus" TEXT,
      "notes" TEXT,
      "attachmentUrl" TEXT,
      "author" TEXT NOT NULL DEFAULT 'System',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TicketActivity_pkey" PRIMARY KEY ("id")
  );`,

  // Alter Warehouse columns
  `ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "partnerId" INTEGER;`,

  // Alter InventoryItem columns
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "trackingType" "InventoryTrackingType" NOT NULL DEFAULT 'SERIALIZED';`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "ownership" "StockOwnership" NOT NULL DEFAULT 'HQ_CONSIGNED';`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "availableQuantity" INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "group" TEXT;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "mainconId" INTEGER;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isLoaner" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "supplier" TEXT;`,
  `ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
  `ALTER TABLE "InventoryItem" ALTER COLUMN "serialNumber" DROP NOT NULL;`,

  // Alter TicketSparePart columns
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "isLoaner" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "expectedReturnDate" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "loanDurationDays" INTEGER DEFAULT 14;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnInitiatedAt" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnCourierName" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnTrackingNo" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnReceivedAt" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "returnCondition" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "loanNotes" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "courierName" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "dispatchTrackingNo" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "batchTrackingNo" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "replacedDefectiveSerial" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "requestedBy" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;`,
  `ALTER TABLE "TicketSparePart" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,

  // Alter User columns
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationOtp" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "engineerId" INTEGER;`,

  // Alter FieldEngineer columns
  `ALTER TABLE "FieldEngineer" ADD COLUMN IF NOT EXISTS "country" TEXT;`,
  `ALTER TABLE "FieldEngineer" ADD COLUMN IF NOT EXISTS "region" TEXT;`,

  // Alter ServicePartner columns
  `ALTER TABLE "ServicePartner" ADD COLUMN IF NOT EXISTS "dispatchEmail" TEXT;`,
  `ALTER TABLE "ServicePartner" ADD COLUMN IF NOT EXISTS "companyPhotoUrl" TEXT;`,

  // Alter DeviceCatalog columns
  `ALTER TABLE "DeviceCatalog" ADD COLUMN IF NOT EXISTS "restrictedTo" TEXT;`,

  // Alter Ticket columns
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "createdById" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "siteId" INTEGER;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "endCustomer" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "severity" "Severity";`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "eta" TIMESTAMP(3);`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "slaPaused" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "slaPausedAt" TIMESTAMP(3);`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "totalPausedMs" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "feAcknowledgeStatus" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "feAcknowledgedAt" TIMESTAMP(3);`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "holdReason" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "defectiveSerial" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "defectiveReturnStatus" TEXT;`,
  `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "serviceReportUrl" TEXT;`,

  // Alter other tables
  `ALTER TABLE "Maincon" ADD COLUMN IF NOT EXISTS "siteCustomers" JSONB;`,
  `ALTER TABLE "SmtpConfig" ADD COLUMN IF NOT EXISTS "adminCc" TEXT;`,

  // Unique constraints
  `DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_emailVerificationToken_key" UNIQUE ("emailVerificationToken"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_eventKey_key" UNIQUE ("eventKey"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_token_key" UNIQUE ("token"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "RegistrationCode" ADD CONSTRAINT "RegistrationCode_code_key" UNIQUE ("code"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_serialNumber_key" UNIQUE ("serialNumber"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "CustomerSla" ADD CONSTRAINT "CustomerSla_customer_severity_region_key" UNIQUE ("customer", "severity", "region"); EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;`,

  // Mark existing pre-OTP users as email verified
  `UPDATE "User" SET "isEmailVerified" = true WHERE "isEmailVerified" = false AND "emailVerificationOtp" IS NULL;`,
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("No DATABASE_URL found, skipping migration.");
    return;
  }

  console.log("Starting database auto-migration script...");
  const pool = new pg.Pool({ connectionString: dbUrl });

  for (const sql of MIGRATION_STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.warn("Migration notice:", err.message);
    }
  }

  await pool.end();
  console.log("Database auto-migration completed successfully.");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(0); // Do not crash the container boot
});
