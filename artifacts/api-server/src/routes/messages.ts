import { Router, type IRouter } from "express";
import { eq, and, or, desc, sql, ilike, inArray } from "drizzle-orm";
import { db, messagesTable, usersTable, MESSAGE_ACCOUNTS, MESSAGE_DEPARTMENT_TO_ACCOUNT } from "@workspace/db";
import { getManagerFromRequest, isManagerToken } from "../lib/managerAuth.js";
import { sendMailFromAlias, syncIncomingMail } from "../lib/mail.js";

const router: IRouter = Router();

async function requireManager(req: any, res: any): Promise<boolean> {
  // Accept either a manager token, or a regular user token whose user.role is "admin".
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (isManagerToken(token)) {
      const m = await getManagerFromRequest(req);
      if (m && m.isActive) return true;
    } else {
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const userId = parseInt(decoded.split(":")[0], 10);
        if (!isNaN(userId)) {
          const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
          if (u && u.isActive && (u.role === "admin" || u.role === "manager")) return true;
        }
      } catch {
        // fall through to 401
      }
    }
  }
  res.status(401).json({ error: "אין הרשאה" });
  return false;
}

// ── Public: contact form ────────────────────────────────────────────────────
router.post("/contact", async (req, res): Promise<void> => {
  const { fullName, email, department, message, captcha, hp } = req.body ?? {};
  // Honeypot — bots fill hidden fields, real users leave empty.
  if (hp) {
    res.json({ ok: true });
    return;
  }
  if (captcha !== true && captcha !== "true") {
    res.status(400).json({ error: "יש לאשר את אימות ה-CAPTCHA" });
    return;
  }
  if (!fullName || !email || !department || !message) {
    res.status(400).json({ error: "כל השדות הם חובה" });
    return;
  }
  if (typeof message !== "string" || message.length > 200) {
    res.status(400).json({ error: "הודעה ארוכה מדי (עד 200 תווים)" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    res.status(400).json({ error: "כתובת אימייל לא חוקית" });
    return;
  }
  const account =
    MESSAGE_DEPARTMENT_TO_ACCOUNT[String(department)] ?? "support@bigshook.com";
  const subject = `פנייה חדשה מטופס יצירת קשר — ${fullName}`;
  const bodyText = `שם: ${fullName}\nאימייל: ${email}\nמחלקה: ${department}\n\n${message}`;
  const bodyHtml = `<div dir="rtl" style="font-family:sans-serif;line-height:1.6">
    <h3>פנייה חדשה מטופס יצירת קשר</h3>
    <p><b>שם:</b> ${escapeHtml(fullName)}<br>
       <b>אימייל:</b> ${escapeHtml(email)}<br>
       <b>מחלקה:</b> ${escapeHtml(department)}</p>
    <p style="white-space:pre-wrap;border-right:3px solid #2563eb;padding-right:12px">${escapeHtml(message)}</p>
  </div>`;

  // Pre-compute a deterministic Message-ID so the IMAP poller can dedupe
  // the SMTP-forwarded copy against our direct DB insert.
  const messageId = `<contact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@bigshook.com>`;

  // Forward to the mailbox so it also lands in Hostinger inbox (with our chosen Message-ID).
  let sentOk = false;
  try {
    await sendMailFromAlias({
      fromAlias: account,
      fromName: `טופס יצירת קשר — ${fullName}`,
      to: account,
      subject,
      text: bodyText,
      html: bodyHtml,
      messageId,
      replyToOverride: String(email),
    });
    sentOk = true;
  } catch (e) {
    console.warn("[contact] forward to mailbox failed", e);
  }

  // Store directly in DB with the SAME Message-ID so the IMAP poller skips the
  // forwarded copy on its next sweep.
  await db.insert(messagesTable).values({
    account,
    direction: "incoming",
    folder: "inbox",
    fromName: String(fullName),
    fromEmail: String(email).toLowerCase(),
    toEmail: account,
    subject,
    bodyText,
    bodyHtml,
    department: String(department),
    isRead: false,
    messageId: sentOk ? messageId : null,
  });

  res.json({ ok: true });
});

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Admin endpoints ────────────────────────────────────────────────────────
router.get("/admin/messages/unread-count", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const rows = await db
    .select({
      account: messagesTable.account,
      count: sql<number>`count(*)::int`,
    })
    .from(messagesTable)
    .where(and(eq(messagesTable.isRead, false), eq(messagesTable.folder, "inbox")))
    .groupBy(messagesTable.account);
  const byAccount: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byAccount[r.account] = r.count;
    total += r.count;
  }
  res.json({ total, byAccount });
});

router.get("/admin/messages", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const account = String(req.query.account ?? "").trim();
  const folder = String(req.query.folder ?? "inbox").trim();
  const search = String(req.query.search ?? "").trim();
  const conditions: any[] = [];
  if (folder) conditions.push(eq(messagesTable.folder, folder as any));
  if (account && account !== "all" && (MESSAGE_ACCOUNTS as readonly string[]).includes(account)) {
    conditions.push(eq(messagesTable.account, account));
  }
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        ilike(messagesTable.subject, q),
        ilike(messagesTable.fromEmail, q),
        ilike(messagesTable.fromName, q),
        ilike(messagesTable.bodyText, q),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(messagesTable)
    .where(where)
    .orderBy(desc(messagesTable.receivedAt))
    .limit(200);
  res.json({ messages: rows });
});

router.get("/admin/messages/:id", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id לא חוקי" }); return; }
  const [row] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!row) { res.status(404).json({ error: "לא נמצא" }); return; }
  if (!row.isRead) {
    await db.update(messagesTable).set({ isRead: true }).where(eq(messagesTable.id, id));
    row.isRead = true;
  }
  res.json(row);
});

router.post("/admin/messages/:id/read", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const isRead = req.body?.isRead !== false;
  await db.update(messagesTable).set({ isRead }).where(eq(messagesTable.id, id));
  res.json({ ok: true });
});

async function moveMessage(id: number, folder: "inbox" | "archive" | "spam" | "trash") {
  await db.update(messagesTable).set({ folder }).where(eq(messagesTable.id, id));
}

router.post("/admin/messages/:id/archive", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  await moveMessage(parseInt(req.params.id, 10), "archive");
  res.json({ ok: true });
});

router.post("/admin/messages/:id/spam", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  await moveMessage(parseInt(req.params.id, 10), "spam");
  res.json({ ok: true });
});

router.post("/admin/messages/:id/restore", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  await moveMessage(parseInt(req.params.id, 10), "inbox");
  res.json({ ok: true });
});

router.delete("/admin/messages/:id", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing) { res.json({ ok: true }); return; }
  if (existing.folder === "trash") {
    await db.delete(messagesTable).where(eq(messagesTable.id, id));
  } else {
    await db.update(messagesTable).set({ folder: "trash" }).where(eq(messagesTable.id, id));
  }
  res.json({ ok: true });
});

router.post("/admin/messages/:id/reply", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const { subject, body } = req.body ?? {};
  if (!body || typeof body !== "string") {
    res.status(400).json({ error: "גוף ההודעה הוא חובה" });
    return;
  }
  const [orig] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!orig) { res.status(404).json({ error: "לא נמצא" }); return; }
  const replySubject =
    (subject && String(subject).trim()) ||
    (orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`);
  try {
    const sendRes = await sendMailFromAlias({
      fromAlias: orig.account,
      to: orig.fromEmail,
      subject: replySubject,
      text: body,
      html: `<div dir="rtl" style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</div>`,
      inReplyTo: orig.messageId,
      references: orig.threadId ?? orig.messageId,
    });
    await db.insert(messagesTable).values({
      account: orig.account,
      direction: "outgoing",
      folder: "sent",
      fromName: "ביג-שווק",
      fromEmail: orig.account,
      toEmail: orig.fromEmail,
      subject: replySubject,
      bodyText: body,
      bodyHtml: null,
      isRead: true,
      messageId: sendRes.messageId,
      inReplyTo: orig.messageId,
      threadId: orig.threadId ?? orig.messageId,
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] reply send failed", err);
    res.status(500).json({ error: err?.message ?? "שליחה נכשלה" });
  }
});

router.post("/admin/messages/sync", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const result = await syncIncomingMail();
  res.json(result);
});

export default router;
