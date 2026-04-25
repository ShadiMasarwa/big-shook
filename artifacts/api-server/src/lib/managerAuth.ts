import crypto from "crypto";
import { db, managersTable, usersTable, DEFAULT_MANAGER_PRIVILEGES } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import type { ManagerPrivileges, PrivilegeLevel, PrivilegeSection } from "@workspace/db";

export type { ManagerPrivileges, PrivilegeLevel, PrivilegeSection };
export { DEFAULT_MANAGER_PRIVILEGES };

export type PrivilegeAction = "read" | "write" | "delete";

// ── Signing secret ────────────────────────────────────────────────────────────
// Evaluated once at module load. Use TOKEN_SECRET env-var in production to keep
// tokens valid across server restarts; the random fallback is safe for dev.
const TOKEN_SECRET: string =
  process.env.TOKEN_SECRET ?? crypto.randomBytes(32).toString("hex");

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

// ── Manager tokens ─────────────────────────────────────────────────────────────
// Format (before base64): m:<managerId>:<timestamp>:<nonce>:<hmac>

export function generateManagerToken(managerId: number): string {
  const payload = `m:${managerId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  const sig = signPayload(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function isManagerToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return decoded.startsWith("m:");
  } catch {
    return false;
  }
}

/** Verify HMAC and return managerId, or null if invalid/tampered. */
export function verifyManagerToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (!decoded.startsWith("m:")) return null;
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;
    const payload = decoded.substring(0, lastColon);
    const sig = decoded.substring(lastColon + 1);
    const expected = signPayload(payload);
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    const parts = payload.split(":");
    // parts: ["m", managerId, timestamp, nonce]
    if (parts.length < 4 || parts[0] !== "m") return null;
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

/** @deprecated Use verifyManagerToken. Kept for compatibility during token rotation. */
export function parseManagerTokenId(token: string): number | null {
  return verifyManagerToken(token);
}

// ── Customer tokens ────────────────────────────────────────────────────────────
// Format (before base64): <userId>:<timestamp>:<nonce>:<hmac>

export function generateCustomerToken(userId: number): string {
  const payload = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  const sig = signPayload(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

/** Verify HMAC and return userId, or null if invalid/tampered. */
export function verifyCustomerToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (decoded.startsWith("m:")) return null; // manager token
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;
    const payload = decoded.substring(0, lastColon);
    const sig = decoded.substring(lastColon + 1);
    const expected = signPayload(payload);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    const parts = payload.split(":");
    // parts: [userId, timestamp, nonce]
    if (parts.length < 3) return null;
    const id = parseInt(parts[0], 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

// ── Privilege helpers ──────────────────────────────────────────────────────────

export function hasPrivilege(
  privileges: ManagerPrivileges | null | undefined,
  section: PrivilegeSection,
  action: PrivilegeAction
): boolean {
  const level: PrivilegeLevel = (privileges as any)?.[section] ?? "all";
  if (action === "read") return true;
  if (action === "write") return level === "read_write" || level === "all";
  if (action === "delete") return level === "all";
  return false;
}

export function serializeManager(m: typeof managersTable.$inferSelect) {
  return {
    id: m.id,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    phone: null,
    city: null,
    street: null,
    houseNumber: null,
    zipCode: null,
    addressNote: null,
    role: "manager" as const,
    loyaltyPoints: 0,
    loyaltyTier: "bronze" as const,
    totalSpent: 0,
    ordersCount: 0,
    marketingEmails: false,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
    privileges: m.privileges,
    managerId: m.id,
    passwordSet: !!m.passwordHash,
  };
}

export async function getManagerFromRequest(req: Request): Promise<typeof managersTable.$inferSelect | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!isManagerToken(token)) return null;
  const managerId = verifyManagerToken(token);
  if (!managerId) return null;
  const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
  return manager ?? null;
}

/**
 * Returns true if the request carries a valid admin-user or active-manager token.
 * Does NOT send any response — caller decides what to do when false.
 */
export async function checkIsAdminOrManager(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");

  if (isManagerToken(token)) {
    const m = await getManagerFromRequest(req);
    return !!(m && m.isActive);
  }

  const userId = verifyCustomerToken(token);
  if (userId === null) return false;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return !!(u && u.isActive && (u.role === "admin" || u.role === "manager"));
}

/**
 * Returns true if the request carries a valid admin-user or active-manager token.
 * Sends a 401 response and returns false otherwise.
 */
export async function requireAdminOrManager(req: Request, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "לא מחובר" });
    return false;
  }
  const token = authHeader.replace("Bearer ", "");

  if (isManagerToken(token)) {
    const m = await getManagerFromRequest(req);
    if (m && m.isActive) return true;
    res.status(401).json({ error: "טוקן לא תקין" });
    return false;
  }

  const userId = verifyCustomerToken(token);
  if (userId === null) {
    res.status(401).json({ error: "טוקן לא תקין" });
    return false;
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (u && u.isActive && (u.role === "admin" || u.role === "manager")) return true;

  res.status(403).json({ error: "אין הרשאה" });
  return false;
}

/**
 * Checks manager privilege for a section+action.
 * - Manager token → validates HMAC, looks up manager, checks privilege.
 * - Customer admin token → validates HMAC, checks role=admin; if so, allowed=true.
 * - Invalid or missing token → allowed=false.
 */
export async function requireManagerPrivilegeCheck(
  req: Request,
  section: PrivilegeSection,
  action: PrivilegeAction
): Promise<{ allowed: boolean; isManager: boolean }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { allowed: false, isManager: false };
  const token = authHeader.replace("Bearer ", "");

  if (isManagerToken(token)) {
    const manager = await getManagerFromRequest(req);
    if (!manager) return { allowed: false, isManager: true };
    if (!manager.isActive) return { allowed: false, isManager: true };
    return {
      allowed: hasPrivilege(manager.privileges, section, action),
      isManager: true,
    };
  }

  // Non-manager token: must be a valid signed token belonging to a real admin user.
  const userId = verifyCustomerToken(token);
  if (userId === null) return { allowed: false, isManager: false };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isActive || user.role !== "admin") {
    return { allowed: false, isManager: false };
  }
  return { allowed: true, isManager: false };
}
