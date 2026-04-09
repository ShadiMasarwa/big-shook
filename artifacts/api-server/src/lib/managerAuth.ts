import crypto from "crypto";
import { db, managersTable, DEFAULT_MANAGER_PRIVILEGES } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { ManagerPrivileges, PrivilegeLevel, PrivilegeSection } from "@workspace/db";

export type { ManagerPrivileges, PrivilegeLevel, PrivilegeSection };
export { DEFAULT_MANAGER_PRIVILEGES };

export type PrivilegeAction = "read" | "write" | "delete";

export function generateManagerToken(managerId: number): string {
  return Buffer.from(
    `m:${managerId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`
  ).toString("base64");
}

export function isManagerToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return decoded.startsWith("m:");
  } catch {
    return false;
  }
}

export function parseManagerTokenId(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (!decoded.startsWith("m:")) return null;
    const id = parseInt(decoded.split(":")[1], 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

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
  const managerId = parseManagerTokenId(token);
  if (!managerId) return null;
  const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
  return manager ?? null;
}

export async function requireManagerPrivilegeCheck(
  req: Request,
  section: PrivilegeSection,
  action: PrivilegeAction
): Promise<{ allowed: boolean; isManager: boolean }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { allowed: false, isManager: false };
  const token = authHeader.replace("Bearer ", "");
  if (!isManagerToken(token)) {
    return { allowed: true, isManager: false };
  }
  const manager = await getManagerFromRequest(req);
  if (!manager) return { allowed: false, isManager: true };
  if (!manager.isActive) return { allowed: false, isManager: true };
  return {
    allowed: hasPrivilege(manager.privileges, section, action),
    isManager: true,
  };
}
