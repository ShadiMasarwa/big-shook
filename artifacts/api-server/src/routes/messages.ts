import { Router, type IRouter } from "express";
import { eq, and, or, desc, sql, ilike, inArray } from "drizzle-orm";
import { db, messagesTable, usersTable, MESSAGE_ACCOUNTS, MESSAGE_DEPARTMENT_TO_ACCOUNT } from "@workspace/db";
import { getManagerFromRequest, isManagerToken, verifyCustomerToken } from "../lib/managerAuth.js";
import {
  sendMailFromAlias,
  syncIncomingMail,
  imapMarkSeen,
  imapMoveTo,
  imapDeletePermanent,
  imapAppendSent,
} from "../lib/mail.js";

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
        const userId = verifyCustomerToken(token);
        if (userId !== null) {
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

// Contact suggestions for autocomplete — MUST be declared before /:id.
router.get("/admin/messages/contacts", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const rows = await db
    .select({
      addr: sql<string>`lower(${messagesTable.fromEmail})`,
      name: messagesTable.fromName,
      lastSeen: sql<string>`max(${messagesTable.receivedAt})`,
    })
    .from(messagesTable)
    .where(eq(messagesTable.direction, "incoming"))
    .groupBy(messagesTable.fromEmail, messagesTable.fromName);
  const sentRows = await db
    .select({
      addr: sql<string>`lower(${messagesTable.toEmail})`,
      lastSeen: sql<string>`max(${messagesTable.receivedAt})`,
    })
    .from(messagesTable)
    .where(eq(messagesTable.direction, "outgoing"))
    .groupBy(messagesTable.toEmail);
  const map = new Map<string, { email: string; name: string | null; lastSeen: string }>();
  for (const r of rows) {
    if (!r.addr) continue;
    if ((MESSAGE_ACCOUNTS as readonly string[]).includes(r.addr)) continue;
    map.set(r.addr, { email: r.addr, name: r.name, lastSeen: r.lastSeen });
  }
  for (const r of sentRows) {
    if (!r.addr) continue;
    if ((MESSAGE_ACCOUNTS as readonly string[]).includes(r.addr)) continue;
    if (!map.has(r.addr)) {
      map.set(r.addr, { email: r.addr, name: null, lastSeen: r.lastSeen });
    }
  }
  let arr = Array.from(map.values());
  if (q) {
    arr = arr.filter(
      (c) => c.email.includes(q) || (c.name ?? "").toLowerCase().includes(q),
    );
  }
  arr.sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
  res.json({ contacts: arr.slice(0, 30) });
});

router.get("/admin/messages/:id", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id לא חוקי" }); return; }
  const [row] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!row) { res.status(404).json({ error: "לא נמצא" }); return; }
  // Reading the full message body alone does NOT mark it read anymore — the
  // client now calls /read explicitly after a 3-second delay.
  res.json(row);
});

router.post("/admin/messages/:id/read", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const isRead = req.body?.isRead !== false;
  const [row] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  await db.update(messagesTable).set({ isRead }).where(eq(messagesTable.id, id));
  // Sync \Seen flag to IMAP — only meaningful when marking as read on incoming.
  if (isRead && row?.direction === "incoming" && row.messageId) {
    imapMarkSeen(row.messageId).catch((e) => console.warn("[messages] imapMarkSeen", e));
  }
  res.json({ ok: true });
});

async function moveMessage(id: number, folder: "inbox" | "archive" | "spam" | "trash") {
  await db.update(messagesTable).set({ folder }).where(eq(messagesTable.id, id));
}

router.post("/admin/messages/:id/archive", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const [row] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  await moveMessage(id, "archive");
  if (row?.direction === "incoming" && row.messageId) {
    imapMoveTo(row.messageId, "Archive").catch((e) => console.warn("[messages] imapMoveTo Archive", e));
  }
  res.json({ ok: true });
});

router.post("/admin/messages/:id/spam", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const [row] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  await moveMessage(id, "spam");
  if (row?.direction === "incoming" && row.messageId) {
    imapMoveTo(row.messageId, "Spam").catch((e) => console.warn("[messages] imapMoveTo Spam", e));
  }
  res.json({ ok: true });
});

router.post("/admin/messages/:id/restore", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  await moveMessage(parseInt(req.params.id, 10), "inbox");
  // We don't try to move back from Spam/Trash in IMAP automatically — too ambiguous.
  res.json({ ok: true });
});

router.delete("/admin/messages/:id", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!existing) { res.json({ ok: true }); return; }
  if (existing.folder === "trash") {
    // Permanent delete — also expunge from IMAP server.
    await db.delete(messagesTable).where(eq(messagesTable.id, id));
    if (existing.direction === "incoming" && existing.messageId) {
      imapDeletePermanent(existing.messageId).catch((e) =>
        console.warn("[messages] imapDeletePermanent", e),
      );
    }
  } else {
    await db.update(messagesTable).set({ folder: "trash" }).where(eq(messagesTable.id, id));
    if (existing.direction === "incoming" && existing.messageId) {
      imapMoveTo(existing.messageId, "Trash").catch((e) =>
        console.warn("[messages] imapMoveTo Trash", e),
      );
    }
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

// ── Empty trash: permanently delete every message in the trash folder. ─────
router.post("/admin/messages/empty-trash", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const rows = await db
    .select({ id: messagesTable.id, messageId: messagesTable.messageId, direction: messagesTable.direction })
    .from(messagesTable)
    .where(eq(messagesTable.folder, "trash"));
  if (!rows.length) { res.json({ deleted: 0 }); return; }
  await db.delete(messagesTable).where(eq(messagesTable.folder, "trash"));
  // Best-effort: expunge each from IMAP too.
  for (const r of rows) {
    if (r.direction === "incoming" && r.messageId) {
      imapDeletePermanent(r.messageId).catch((e) =>
        console.warn("[messages] empty-trash imapDeletePermanent", e),
      );
    }
  }
  res.json({ deleted: rows.length });
});

// ── Bulk move: move multiple messages to a destination folder. ─────────────
router.post("/admin/messages/bulk", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const { ids, action } = req.body ?? {};
  const idArr = Array.isArray(ids) ? ids.map((x: any) => parseInt(x, 10)).filter((n) => !isNaN(n)) : [];
  if (!idArr.length) { res.status(400).json({ error: "לא נבחרו הודעות" }); return; }
  const allowed = ["archive", "spam", "sent", "trash", "inbox", "delete"] as const;
  if (!allowed.includes(action)) { res.status(400).json({ error: "פעולה לא חוקית" }); return; }

  const rows = await db
    .select({ id: messagesTable.id, messageId: messagesTable.messageId, direction: messagesTable.direction })
    .from(messagesTable)
    .where(inArray(messagesTable.id, idArr));

  if (action === "delete") {
    await db.delete(messagesTable).where(inArray(messagesTable.id, idArr));
    for (const r of rows) {
      if (r.direction === "incoming" && r.messageId) {
        imapDeletePermanent(r.messageId).catch((e) =>
          console.warn("[messages] bulk imapDeletePermanent", e),
        );
      }
    }
  } else {
    await db
      .update(messagesTable)
      .set({ folder: action as any })
      .where(inArray(messagesTable.id, idArr));
    const intent =
      action === "archive" ? "Archive" :
      action === "spam" ? "Spam" :
      action === "trash" ? "Trash" : null;
    if (intent) {
      for (const r of rows) {
        if (r.direction === "incoming" && r.messageId) {
          imapMoveTo(r.messageId, intent).catch((e) =>
            console.warn("[messages] bulk imapMoveTo", intent, e),
          );
        }
      }
    }
  }
  res.json({ ok: true, count: idArr.length });
});

// ── Compose new message ────────────────────────────────────────────────────
router.post("/admin/messages/compose", async (req, res): Promise<void> => {
  if (!(await requireManager(req, res))) return;
  const { from, to, subject, body } = req.body ?? {};
  const fromAddr = String(from ?? "").trim().toLowerCase();
  const toAddr = String(to ?? "").trim();
  const subj = String(subject ?? "").trim();
  const bodyStr = String(body ?? "");
  if (!(MESSAGE_ACCOUNTS as readonly string[]).includes(fromAddr)) {
    res.status(400).json({ error: "כתובת שולח לא חוקית" });
    return;
  }
  if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
    res.status(400).json({ error: "כתובת נמען לא חוקית" });
    return;
  }
  if (!subj) {
    res.status(400).json({ error: "נושא הוא חובה" });
    return;
  }
  if (!bodyStr.trim()) {
    res.status(400).json({ error: "גוף ההודעה הוא חובה" });
    return;
  }
  try {
    const html = `<div dir="rtl" style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(bodyStr)}</div>`;
    const sendRes = await sendMailFromAlias({
      fromAlias: fromAddr,
      to: toAddr,
      subject: subj,
      text: bodyStr,
      html,
    });
    await db.insert(messagesTable).values({
      account: fromAddr,
      direction: "outgoing",
      folder: "sent",
      fromName: "ביג-שווק",
      fromEmail: fromAddr,
      toEmail: toAddr,
      subject: subj,
      bodyText: bodyStr,
      bodyHtml: html,
      isRead: true,
      messageId: sendRes.messageId,
    });
    // Best-effort: append to IMAP "Sent" folder so it shows up in webmail too.
    imapAppendSent({
      fromAlias: fromAddr,
      to: toAddr,
      subject: subj,
      text: bodyStr,
      html,
      messageId: sendRes.messageId,
    }).catch((e) => console.warn("[messages] imapAppendSent", e));
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] compose send failed", err);
    res.status(500).json({ error: err?.message ?? "שליחה נכשלה" });
  }
});

export default router;
