-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'FOLLOW_UP', 'COMPLETE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('STANDARD', 'ON_REQUEST');

-- CreateTable
CREATE TABLE "State" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maincon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "customFieldsSchema" JSONB NOT NULL,
    "siteCustomers" JSONB,

    CONSTRAINT "Maincon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePartner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "statesCovered" JSONB NOT NULL,

    CONSTRAINT "ServicePartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldEngineer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,

    CONSTRAINT "FieldEngineer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCatalog" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isStandard" BOOLEAN NOT NULL,
    "restrictedTo" TEXT,

    CONSTRAINT "DeviceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketRefNo" TEXT,
    "clientSiteName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "subStatus" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "endCustomer" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mainconId" INTEGER NOT NULL,
    "customValues" JSONB NOT NULL,
    "partnerId" INTEGER,
    "assignedFeId" INTEGER,
    "deviceId" INTEGER,
    "deviceStatus" "DeviceStatus",
    "customDeviceDetails" TEXT,
    "siteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolutionDetails" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndCustomerSite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "mainconId" INTEGER NOT NULL,

    CONSTRAINT "EndCustomerSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

-- AddForeignKey
ALTER TABLE "FieldEngineer" ADD CONSTRAINT "FieldEngineer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ServicePartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_mainconId_fkey" FOREIGN KEY ("mainconId") REFERENCES "Maincon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ServicePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedFeId_fkey" FOREIGN KEY ("assignedFeId") REFERENCES "FieldEngineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "EndCustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndCustomerSite" ADD CONSTRAINT "EndCustomerSite_mainconId_fkey" FOREIGN KEY ("mainconId") REFERENCES "Maincon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
