import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "ticketlink_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "ticketlink-secure-secret-key-2026-production-salt"
);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  partnerId: number | null;
  engineerId: number | null;
}

/**
 * Hash a plaintext password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plaintext password with a stored hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Encrypt and sign a session payload into a JWT string.
 */
export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT session token.
 */
export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sets the HTTP-only session cookie for the logged-in user.
 */
export async function createSessionCookie(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  partnerId: number | null;
  engineerId: number | null;
}) {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    partnerId: user.partnerId,
    engineerId: user.engineerId,
  };

  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

/**
 * Clears the session cookie on logout.
 */
export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  partnerId: true,
  engineerId: true,
  createdAt: true,
  updatedAt: true,
  partner: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      dispatchEmail: true,
      companyPhotoUrl: true,
      statesCovered: true,
    },
  },
  engineer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      country: true,
      region: true,
      partnerId: true,
      partner: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          dispatchEmail: true,
          companyPhotoUrl: true,
          statesCovered: true,
        },
      },
    },
  },
} as const;

/**
 * Strips sensitive fields (password hash, OTP, verification tokens) from any user object.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T | null): T | null {
  if (!user) return null;
  const clone = { ...user };
  delete (clone as any).passwordHash;
  delete (clone as any).emailVerificationOtp;
  delete (clone as any).emailVerificationToken;
  delete (clone as any).emailVerificationExpiresAt;
  return clone;
}

/**
 * Retrieves the current session user without exposing sensitive credentials.
 */
export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await decryptSession(token);
    if (!payload?.userId) return null;

    // Fetch fresh user data with relations from PostgreSQL, safely excluding credential hashes
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: SAFE_USER_SELECT,
    });

    if (!user || user.isActive === false) return null;

    // If user.partner is not directly linked on User, use user.engineer.partner
    if (!user.partner && (user as any).engineer?.partner) {
      (user as any).partner = (user as any).engineer.partner;
    }

    return user;
  } catch (error) {
    console.error("Error reading session:", error);
    return null;
  }
}

/**
 * Requires a valid active session user. Throws an error if unauthenticated.
 */
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized: Sesi tidak sah atau telah tamat tempoh. Sila log masuk semula.");
  }
  return user;
}

/**
 * Requires a valid active session user with one of the allowed roles.
 */
export async function requireRoles(allowedRoles: string[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Unauthorized: Peranan ${user.role} tidak mempunyai kebenaran untuk operasi ini.`);
  }
  return user;
}
