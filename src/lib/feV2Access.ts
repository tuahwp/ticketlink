/**
 * Normalizes phone number: strips non-digits and converts leading 60 to 0.
 */
export function normalizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("60")) {
    digits = "0" + digits.slice(2);
  }
  return digits;
}

export interface FeV2CheckableUser {
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  engineer?: {
    phone?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Checks whether a user is allowed to access the /fe-v2 portal.
 *
 * Rules:
 * 1. SUPERADMIN is always allowed.
 * 2. Matches strictly on user.email (case-insensitive, trimmed).
 * 3. OR matches normalized phone number against user.engineer.phone or user.phone.
 * 4. Strictly NEVER matches on user.name or email prefix.
 */
export function isUserInFeV2Allowlist(user: FeV2CheckableUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "SUPERADMIN") return true;

  const rawAllowlist = process.env.FE_V2_USERS || "";
  if (!rawAllowlist.trim()) return false;

  const allowEntries = rawAllowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowEntries.length === 0) return false;

  const userEmail = (user.email || user.engineer?.email || "").toLowerCase().trim();
  const userPhone = normalizePhoneNumber(user.phone || user.engineer?.phone);

  for (const entry of allowEntries) {
    const entryLower = entry.toLowerCase();

    // 1. Strict email match
    if (userEmail && entryLower === userEmail) {
      return true;
    }

    // 2. Normalized phone match (exact match only after normalization)
    if (!entry.includes("@")) {
      const entryPhone = normalizePhoneNumber(entry);
      if (entryPhone && userPhone && entryPhone === userPhone) {
        return true;
      }
    }
  }

  return false;
}
