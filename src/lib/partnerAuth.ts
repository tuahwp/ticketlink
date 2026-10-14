import crypto from "crypto";
import { db } from "./db";

export interface PartnerAuthResult {
  partnerId: number;
  partnerName: string;
  keyPrefix: string;
  env: string;
}

const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || "ticketlink-secure-session-jwt-key-2026-production")
  .digest();

/**
 * Encrypts a raw token string for secure reversible storage.
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a stored encrypted token.
 */
export function decryptToken(encryptedString?: string | null): string {
  if (!encryptedString) return "";
  try {
    const [ivHex, encrypted] = encryptedString.split(":");
    if (!ivHex || !encrypted) return "";
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return "";
  }
}

/**
 * Generates a cryptographically secure API key for a Service Partner.
 * Returns the raw key and creates the database record with encrypted reversible copy.
 */
export async function createPartnerApiKeyRecord(
  partnerId: number,
  name: string,
  env: "SANDBOX" | "PRODUCTION" = "PRODUCTION"
) {
  const prefix = env === "SANDBOX" ? "tl_test_" : "tl_live_";
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawKey = `${prefix}${randomBytes}`;
  const keyPrefix = `${prefix}${randomBytes.substring(0, 6)}...`;
  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  const encryptedKey = encryptToken(rawKey);

  const record = await (db as any).partnerApiKey.create({
    data: {
      partnerId,
      name,
      keyPrefix,
      hashedKey,
      encryptedKey,
      env,
      isActive: true,
    },
    include: {
      partner: true,
    },
  });

  return {
    rawKey,
    keyRecord: record,
  };
}

/**
 * Validates a Bearer token from an incoming HTTP Request.
 * Returns Partner authentication details or null if invalid.
 */
export async function verifyPartnerApiKey(request: Request): Promise<PartnerAuthResult | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authHeader.substring(7).trim();
  if (!rawKey) return null;

  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    const keyRecord = await (db as any).partnerApiKey.findFirst({
      where: {
        hashedKey,
        isActive: true,
      },
      include: {
        partner: true,
      },
    });

    if (!keyRecord) return null;

    // Check expiration if set
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return null;
    }

    // Update lastUsedAt asynchronously
    (db as any).partnerApiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      partnerId: keyRecord.partnerId,
      partnerName: keyRecord.partner.name,
      keyPrefix: keyRecord.keyPrefix,
      env: keyRecord.env,
    };
  } catch (error) {
    console.error("verifyPartnerApiKey error:", error);
    return null;
  }
}

/**
 * Generates HMAC-SHA256 signature for outgoing webhook payload.
 */
export function generateWebhookSignature(payloadString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

/**
 * Dispatches an outbound webhook event to the partner's subscribed endpoint.
 * Logs the delivery attempt into PartnerSyncLog.
 */
export async function dispatchPartnerWebhook(
  partnerId: number,
  event: string,
  ticketId: number | null,
  data: any
) {
  try {
    const webhook = await (db as any).partnerWebhook.findFirst({
      where: {
        partnerId,
        isActive: true,
      },
    });

    if (!webhook || !webhook.url) return;

    // Check if event is subscribed
    const subscribedEvents: string[] = Array.isArray(webhook.events)
      ? webhook.events
      : typeof webhook.events === "string"
      ? JSON.parse(webhook.events || "[]")
      : [];

    if (subscribedEvents.length > 0 && !subscribedEvents.includes("*") && !subscribedEvents.includes(event)) {
      return;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      partnerId,
      ticketId,
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, webhook.secret || "default-secret");

    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-TicketLink-Event": event,
      "X-TicketLink-Signature": `sha256=${signature}`,
      "User-Agent": "TicketLink-Webhook/1.0",
    };

    if (webhook.authHeader && webhook.authHeader.trim()) {
      const auth = webhook.authHeader.trim();
      headers["Authorization"] = auth.startsWith("Bearer ") || auth.startsWith("Basic ") ? auth : `Bearer ${auth}`;
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      responseStatus = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 1000); // Truncate response for storage
    } catch (err: any) {
      errorMessage = err.message || "Network / Timeout Error";
    }

    const durationMs = Date.now() - startTime;

    // Record delivery log
    await (db as any).partnerSyncLog.create({
      data: {
        partnerId,
        ticketId,
        direction: "OUTBOUND_WEBHOOK",
        endpoint: webhook.url,
        action: event,
        requestPayload: payload,
        responseStatus,
        responseBody,
        errorMessage,
        durationMs,
      },
    });
  } catch (err) {
    console.error(`Failed to dispatch partner webhook for partner ${partnerId}:`, err);
  }
}
