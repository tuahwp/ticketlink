-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'ON_HOLD';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "eta" TIMESTAMP(3),
ADD COLUMN     "feAcknowledgeStatus" TEXT,
ADD COLUMN     "feAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "slaPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaPausedAt" TIMESTAMP(3),
ADD COLUMN     "totalPausedMs" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TicketActivity" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT,
    "subStatus" TEXT,
    "notes" TEXT,
    "author" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
