require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

async function seedKey() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:my1p@ssw0rd@localhost:5432/ticketlink-db-dev?schema=public'
  });

  await client.connect();

  const partnerId = 3; // ITS Smart Global Solutions
  const rawKey = 'tl_live_its_test_key_jpj_2026_demo';
  const keyPrefix = 'tl_live_its_tes...';
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  const SECRET_KEY = crypto.createHash("sha256").update(process.env.SESSION_SECRET || "ticketlink-secure-session-jwt-key-2026-production").digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
  let enc = cipher.update(rawKey, "utf8", "hex");
  enc += cipher.final("hex");
  const encryptedKey = `${iv.toString("hex")}:${enc}`;

  // Insert or update test key
  await client.query(`
    DELETE FROM "PartnerApiKey" WHERE "partnerId" = $1 AND "name" = 'ITS JPJ Primary System Key';
  `, [partnerId]);

  const insertRes = await client.query(`
    INSERT INTO "PartnerApiKey" ("partnerId", "name", "keyPrefix", "hashedKey", "encryptedKey", "env", "isActive", "createdAt", "updatedAt")
    VALUES ($1, 'ITS JPJ Primary System Key', $2, $3, $4, 'PRODUCTION', true, NOW(), NOW())
    RETURNING id, name, "keyPrefix", env;
  `, [partnerId, keyPrefix, hashedKey, encryptedKey]);

  console.log('Seeded PartnerApiKey for ITS:', insertRes.rows[0]);

  // Insert test webhook config for ITS if not present
  await client.query(`
    DELETE FROM "PartnerWebhook" WHERE "partnerId" = $1;
  `, [partnerId]);

  const whRes = await client.query(`
    INSERT INTO "PartnerWebhook" ("partnerId", "url", "secret", "events", "isActive", "createdAt", "updatedAt")
    VALUES ($1, 'https://its-ticket.example.com/api/webhooks/ticketlink', 'sec_its_hmac_secret_2026', '["ticket.dispatched", "ticket.status_changed", "ticket.resolved"]'::jsonb, true, NOW(), NOW())
    RETURNING id, url, secret;
  `, [partnerId]);

  console.log('Seeded PartnerWebhook for ITS:', whRes.rows[0]);

  await client.end();
}

seedKey().catch(console.error);
