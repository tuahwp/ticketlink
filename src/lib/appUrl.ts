import { headers } from "next/headers";

/**
 * Dynamically resolves the active application URL.
 * Works seamlessly in both local development and production without hardcoding:
 * 1. Uses explicit appOrigin if provided (e.g., from client window.location.origin)
 * 2. Uses NEXT_PUBLIC_APP_URL or APP_URL env variable if set (and not localhost in prod)
 * 3. Dynamically extracts from incoming HTTP request headers (x-forwarded-host / host + x-forwarded-proto)
 * 4. Falls back to http://localhost:3000 in local dev context
 */
export async function getAppUrl(explicitOrigin?: string): Promise<string> {
  if (explicitOrigin && typeof explicitOrigin === "string" && explicitOrigin.startsWith("http") && !explicitOrigin.includes("localhost")) {
    return explicitOrigin.replace(/\/$/, "");
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http") && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (host && host.includes("localhost") ? "http" : "https");

    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // headers() might not be available in standalone non-request contexts
  }

  return (envUrl || explicitOrigin || "http://localhost:3000").replace(/\/$/, "");
}
