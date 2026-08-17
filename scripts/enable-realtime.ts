import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

function getPrisma() {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("postgresql:") || url.startsWith("postgres:")) {
    const pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } else {
    throw new Error("Only PostgreSQL / Supabase connection is supported for Realtime replication.");
  }
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("postgresql:") && !url.startsWith("postgres:")) {
    console.log("SQLite database detected. Skipping Supabase Realtime PostgreSQL replication setup.");
    return;
  }

  const prisma = getPrisma();
  try {
    console.log("Enabling Supabase Realtime replication on 'Ticket' table...");
    
    // Check if table is already registered in the publication
    const checkResult = await prisma.$queryRaw<any[]>`
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'Ticket';
    `;
    
    if (checkResult && checkResult.length > 0) {
      console.log("Realtime replication is already enabled for the 'Ticket' table.");
    } else {
      await prisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE "Ticket";');
      console.log("Successfully added 'Ticket' table to the 'supabase_realtime' publication!");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already member")) {
      console.log("Realtime is already active for the 'Ticket' table.");
    } else {
      console.warn("Could not modify replication publication. Realtime might already be configured or permissions are restricted:", msg);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
