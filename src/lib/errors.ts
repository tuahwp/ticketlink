/**
 * User-Facing Error System & Safe Server Action Results
 *
 * In production Next.js, thrown errors from Server Actions have their
 * messages masked with a generic digest string. For business logic errors
 * and validated transitions, server actions return `{ ok: false, error, code }`
 * or throw a `UserFacingError` to ensure safe, localized BM display.
 */

export class UserFacingError extends Error {
  public readonly code?: string;
  public readonly isUserFacing = true;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "UserFacingError";
    this.code = code;
    Object.setPrototypeOf(this, UserFacingError.prototype);
  }
}

export type ServerActionResult<T = any> =
  | { ok: true; data: T; error?: never; code?: never }
  | { ok: false; error: string; code?: string; data?: never };

/**
 * Checks if an error represents a Next.js Server Action build/hash mismatch.
 * This happens when a client invokes an action from a previous deployment.
 */
export function isServerActionMismatch(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : (err as any)?.message || String(err);
  return (
    typeof msg === "string" &&
    (msg.includes("Failed to find Server Action") ||
      msg.includes("could not be found") ||
      msg.includes("SERVER_ACTION_MISMATCH"))
  );
}

/**
 * Normalizes any error (Error object, server response, or rejection) into
 * a safe, user-friendly message. Strict allowlist: only explicitly user-facing
 * messages or known deploy mismatches are exposed; all raw technical/stack
 * errors are sanitized to prevent technical leak in production.
 */
export function sanitizeErrorMessage(
  err: unknown,
  fallbackMessage: string = "Ralat sistem berlaku. Sila cuba sebentar lagi atau muat semula halaman."
): { message: string; isDeployMismatch: boolean } {
  if (!err) {
    return { message: fallbackMessage, isDeployMismatch: false };
  }

  // 1. Deploy action hash mismatch
  if (isServerActionMismatch(err)) {
    return {
      message: "Versi baharu tersedia, sila muat semula.",
      isDeployMismatch: true,
    };
  }

  // 2. UserFacingError or marked user-facing object
  if (err instanceof UserFacingError || (typeof err === "object" && (err as any)?.isUserFacing)) {
    return { message: (err as any).message || fallbackMessage, isDeployMismatch: false };
  }

  // 3. Object with { ok: false, error: string } or { success: false, error: string }
  if (typeof err === "object") {
    const obj = err as any;
    if (obj.ok === false && typeof obj.error === "string") {
      if (isServerActionMismatch(obj.error)) {
        return { message: "Versi baharu tersedia, sila muat semula.", isDeployMismatch: true };
      }
      return { message: obj.error, isDeployMismatch: false };
    }
    if (obj.success === false && typeof obj.error === "string") {
      if (isServerActionMismatch(obj.error)) {
        return { message: "Versi baharu tersedia, sila muat semula.", isDeployMismatch: true };
      }
      return { message: obj.error, isDeployMismatch: false };
    }
  }

  // 4. Default fallback for unhandled technical crashes, raw errors, or Next.js production digests
  return { message: fallbackMessage, isDeployMismatch: false };
}
