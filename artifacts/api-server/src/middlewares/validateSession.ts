import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, managersTable } from "@workspace/db";
import {
  isManagerToken,
  verifyManagerToken,
  verifyCustomerToken,
  extractTokenIssuedAt,
} from "../lib/managerAuth.js";

/**
 * Global bearer-session validation middleware.
 *
 * Runs before all /api routes. When a request includes an Authorization header:
 *  - Verifies the HMAC signature + age + in-process revocation (via verify* functions).
 *  - Loads the principal from the DB and checks isActive and sessionInvalidatedAt.
 *  - Returns 401 if the session is invalid for any reason.
 *  - Stores the valid principal in res.locals.authUser or res.locals.authManager.
 *
 * Requests without an Authorization header pass through unchanged, allowing
 * anonymous access to public routes.
 */
export async function validateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next(); return;
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    if (isManagerToken(token)) {
      const managerId = verifyManagerToken(token);
      if (!managerId) {
        res.status(401).json({ error: "טוקן לא תקין" }); return;
      }
      const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
      if (!manager) {
        res.status(401).json({ error: "טוקן לא תקין" }); return;
      }
      if (!manager.isActive) {
        res.status(403).json({ error: "account_inactive" }); return;
      }
      if (manager.sessionInvalidatedAt) {
        const issuedAt = extractTokenIssuedAt(token);
        if (issuedAt === null || issuedAt < manager.sessionInvalidatedAt.getTime()) {
          res.status(401).json({ error: "טוקן לא תקין" }); return;
        }
      }
      res.locals.authManager = manager;
    } else {
      const userId = verifyCustomerToken(token);
      if (userId === null) {
        res.status(401).json({ error: "טוקן לא תקין" }); return;
      }
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (!user) {
        res.status(401).json({ error: "טוקן לא תקין" }); return;
      }
      if (!user.isActive) {
        res.status(403).json({ error: "account_inactive" }); return;
      }
      if (user.sessionInvalidatedAt) {
        const issuedAt = extractTokenIssuedAt(token);
        if (issuedAt === null || issuedAt < user.sessionInvalidatedAt.getTime()) {
          res.status(401).json({ error: "טוקן לא תקין" }); return;
        }
      }
      res.locals.authUser = user;
    }
  } catch {
    // On unexpected errors, reject the session to fail secure
    res.status(401).json({ error: "טוקן לא תקין" }); return;
  }

  next();
}
