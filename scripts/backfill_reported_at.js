/**
 * Skrip Backfill: Mengisi medan reportedAt yang NULL dengan nilai createdAt.
 *
 * NOTA KESELAMATAN:
 * - Disediakan untuk disemak dan dijalankan secara manual oleh pentadbir sistem.
 * - Lalai adalah mod SIMULASI (--dry-run).
 * - Gunakan hujah --execute untuk melaksanakan perubahan sebenar.
 *
 * Penggunaan:
 *   node scripts/backfill_reported_at.js             (Mod Semakan / Dry-Run)
 *   node scripts/backfill_reported_at.js --execute   (Mod Pelaksanaan Sebenar)
 */

require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const isExecute = process.argv.includes("--execute");
  const isForceProd = process.argv.includes("--force-production");

  console.log("=================================================");
  console.log(" TICKETLINK: BACKFILL reportedAt <- createdAt");
  console.log("=================================================");
  console.log(`Mod: ${isExecute ? "PELAKSANAAN SEBENAR (--execute)" : "SIMULASI (DRY-RUN)"}`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("RALAT: DATABASE_URL tidak dijumpai dalam persekitaran (.env).");
    process.exit(1);
  }

  // Pengawal keselamatan persekitaran production
  if (process.env.NODE_ENV === "production" && !isForceProd) {
    console.error("AMARAN KESELAMATAN: Skrip ini dikesan dalam persekitaran PRODUCTION!");
    console.error("Untuk keselamatan, skrip disekat daripada berjalan secara automatik.");
    console.error("Sila jalankan ujian pada persekitaran staging/local terlebih dahulu.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const client = await pool.connect();
    try {
      // 1. Semak jumlah rekod yang mempunyai reportedAt NULL
      const countRes = await client.query(
        `SELECT COUNT(*) AS total FROM "Ticket" WHERE "reportedAt" IS NULL;`
      );
      const totalNull = parseInt(countRes.rows[0].total, 10);

      console.log(`\nJumlah tiket dengan 'reportedAt' NULL: ${totalNull}`);

      if (totalNull === 0) {
        console.log("Semua rekod tiket telah mempunyai 'reportedAt' yang sah. Tiada tindakan diperlukan.");
        return;
      }

      // Paparkan sampel 5 tiket teratas yang terjejas
      const sampleRes = await client.query(
        `SELECT id, "ticketRefNo", "createdAt", "reportedAt" 
         FROM "Ticket" 
         WHERE "reportedAt" IS NULL 
         ORDER BY id DESC 
         LIMIT 5;`
      );
      console.log("\nSampel tiket yang akan dikemas kini (hingga 5 rekod):");
      console.table(sampleRes.rows);

      if (!isExecute) {
        console.log("\n[SIMULASI SAHAJA] Tiada data diubah.");
        console.log("Untuk melaksanakan pengemaskinian sebenar, jalankan:");
        console.log("  node scripts/backfill_reported_at.js --execute\n");
        return;
      }

      // 2. Laksanakan pengemaskinian sebenar
      console.log("\nMelaksanakan pengemaskinian dalam transaksi...");
      await client.query("BEGIN;");

      const updateRes = await client.query(
        `UPDATE "Ticket" 
         SET "reportedAt" = "createdAt" 
         WHERE "reportedAt" IS NULL;`
      );

      await client.query("COMMIT;");
      console.log(`BERJAYA! ${updateRes.rowCount} rekod tiket telah dikemas kini: reportedAt = createdAt.`);
    } catch (queryErr) {
      await client.query("ROLLBACK;");
      throw queryErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Ralat semasa menjalankan skrip backfill:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
