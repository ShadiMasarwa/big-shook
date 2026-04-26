import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { db, messagesTable, MESSAGE_ACCOUNTS } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return { host, port, user, pass };
}

let _transporter: Transporter | null = null;
export function getMailTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  const cfg = getSmtpConfig();
  if (!cfg.user || !cfg.pass) return null;
  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return _transporter;
}

export async function sendMailFromAlias(opts: {
  fromAlias: string;
  fromName?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
  messageId?: string;
  replyToOverride?: string;
}): Promise<{ messageId: string }> {
  const transporter = getMailTransporter();
  if (!transporter) throw new Error("SMTP not configured");
  const fromName = opts.fromName ?? "ביג-שווק";
  const info = await transporter.sendMail({
    from: `"${fromName}" <${opts.fromAlias}>`,
    sender: getSmtpConfig().user!,
    replyTo: opts.replyToOverride ?? opts.fromAlias,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references ?? undefined,
    messageId: opts.messageId,
  });
  return { messageId: info.messageId };
}

function getImapConfig() {
  const host = process.env.IMAP_HOST ?? "imap.hostinger.com";
  const port = parseInt(process.env.IMAP_PORT ?? "993", 10);
  const user = process.env.IMAP_USER ?? process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS ?? process.env.SMTP_PASS;
  return { host, port, user, pass };
}

let imapBusy = false;

/**
 * Connects to the configured IMAP mailbox, fetches every NEW message in INBOX
 * (those with a Message-ID we have not seen before), parses, classifies by the
 * "To" header (matched against our 4 alias addresses), and stores in the DB.
 *
 * Returns count of newly stored messages.
 */
export async function syncIncomingMail(): Promise<{
  fetched: number;
  stored: number;
  error?: string;
}> {
  if (imapBusy) return { fetched: 0, stored: 0, error: "sync already running" };
  const cfg = getImapConfig();
  if (!cfg.user || !cfg.pass) {
    return { fetched: 0, stored: 0, error: "IMAP not configured" };
  }
  imapBusy = true;
  let fetched = 0;
  let stored = 0;
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const sinceDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
      // Search messages from the last 30 days; existing ones are deduped by Message-ID.
      const uids = await client.search({ since: sinceDate });
      if (Array.isArray(uids) && uids.length > 0) {
        for await (const msg of client.fetch(uids, { source: true, envelope: true })) {
          fetched++;
          if (!msg.source) continue;
          let parsed;
          try {
            parsed = await simpleParser(msg.source);
          } catch {
            continue;
          }
          const messageIdHeader = parsed.messageId ?? msg.envelope?.messageId ?? null;
          if (messageIdHeader) {
            const [exists] = await db
              .select({ id: messagesTable.id })
              .from(messagesTable)
              .where(eq(messagesTable.messageId, messageIdHeader))
              .limit(1);
            if (exists) continue;
          }
          const fromAddr = parsed.from?.value?.[0];
          const toList = Array.isArray(parsed.to)
            ? parsed.to.flatMap((t) => t.value ?? [])
            : (parsed.to?.value ?? []);
          const matchedAccount =
            toList
              .map((t) => (t.address ?? "").toLowerCase())
              .find((addr) => (MESSAGE_ACCOUNTS as readonly string[]).includes(addr)) ??
            (cfg.user ?? "support@bigshook.com").toLowerCase();
          const toEmail = toList.map((t) => t.address).filter(Boolean).join(", ");
          await db.insert(messagesTable).values({
            account: matchedAccount,
            direction: "incoming",
            folder: "inbox",
            fromName: fromAddr?.name || null,
            fromEmail: (fromAddr?.address || "unknown").toLowerCase(),
            toEmail: toEmail || matchedAccount,
            subject: parsed.subject ?? "(ללא נושא)",
            bodyText: (parsed.text ?? "").slice(0, 50000),
            bodyHtml: parsed.html
              ? sanitizeHtml(String(parsed.html), {
                  allowedTags: [
                    "p", "br", "b", "i", "u", "s", "strong", "em",
                    "h1", "h2", "h3", "h4", "h5", "h6",
                    "ul", "ol", "li",
                    "blockquote", "pre", "code",
                    "a", "img",
                    "table", "thead", "tbody", "tr", "th", "td",
                    "figure", "figcaption",
                    "hr", "span",
                  ],
                  allowedAttributes: {
                    "*": ["dir", "lang", "align", "valign"],
                    a: ["href", "name", "rel"],
                    img: ["src", "alt", "width", "height"],
                    td: ["colspan", "rowspan", "width", "height"],
                    th: ["colspan", "rowspan", "width", "height"],
                    table: ["width", "border", "cellpadding", "cellspacing"],
                  },
                  allowedSchemes: ["https", "mailto"],
                  allowedSchemesByTag: { img: ["https", "cid"] },
                  disallowedTagsMode: "discard",
                  transformTags: {
                    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
                  },
                }).slice(0, 200000)
              : null,
            isRead: false,
            messageId: messageIdHeader ?? null,
            inReplyTo: parsed.inReplyTo ?? null,
            threadId: (parsed.references && (Array.isArray(parsed.references) ? parsed.references[0] : parsed.references)) || messageIdHeader || null,
            receivedAt: parsed.date ?? new Date(),
          });
          stored++;
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: any) {
    return { fetched, stored, error: err?.message ?? String(err) };
  } finally {
    imapBusy = false;
  }
  return { fetched, stored };
}

// ── IMAP sync helpers (best-effort) ────────────────────────────────────────
async function withImapClient<T>(
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T | null> {
  const cfg = getImapConfig();
  if (!cfg.user || !cfg.pass) return null;
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  try {
    await client.connect();
    return await fn(client);
  } catch (e: any) {
    console.warn("[imap-op]", e?.message ?? e);
    return null;
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

type IntentFolder = "Archive" | "Spam" | "Trash";

async function resolveFolder(
  client: ImapFlow,
  intent: IntentFolder,
): Promise<string | null> {
  const list = (await client.list()) as Array<{
    path: string;
    name: string;
    specialUse?: string;
  }>;
  const match = (re: RegExp, special?: string) =>
    list.find(
      (l) =>
        (special && l.specialUse === special) ||
        re.test(l.name) ||
        re.test(l.path),
    );
  if (intent === "Archive") return match(/^archive$/i)?.path ?? match(/archive/i)?.path ?? null;
  if (intent === "Spam") return match(/^(spam|junk)$/i, "\\Junk")?.path ?? match(/spam|junk/i)?.path ?? null;
  if (intent === "Trash") return match(/^trash$/i, "\\Trash")?.path ?? match(/trash|deleted/i)?.path ?? null;
  return null;
}

async function findUidByMessageId(
  client: ImapFlow,
  mailbox: string,
  messageId: string,
): Promise<number[]> {
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const result = await client.search(
        { header: { "message-id": messageId } } as any,
        { uid: true },
      );
      return Array.isArray(result) ? (result as number[]) : [];
    } finally {
      lock.release();
    }
  } catch {
    return [];
  }
}

const SEARCH_MAILBOXES = ["INBOX", "INBOX.Archive", "Archive", "INBOX.Spam", "Spam", "Junk", "INBOX.Trash", "Trash"];

/** Mark a message as Seen on the IMAP server (best-effort). */
export async function imapMarkSeen(messageId: string): Promise<void> {
  if (!messageId) return;
  await withImapClient(async (client) => {
    for (const box of SEARCH_MAILBOXES) {
      const uids = await findUidByMessageId(client, box, messageId);
      if (uids.length) {
        const lock = await client.getMailboxLock(box);
        try {
          await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
        return;
      }
    }
  });
}

/** Move a message to Archive/Spam/Trash on the IMAP server (best-effort). */
export async function imapMoveTo(
  messageId: string,
  intent: IntentFolder,
): Promise<void> {
  if (!messageId) return;
  await withImapClient(async (client) => {
    const target = await resolveFolder(client, intent);
    if (!target) {
      console.warn(`[imap-op] no folder found for intent=${intent}`);
      return;
    }
    for (const box of SEARCH_MAILBOXES) {
      if (box === target) continue;
      const uids = await findUidByMessageId(client, box, messageId);
      if (uids.length) {
        const lock = await client.getMailboxLock(box);
        try {
          await client.messageMove(uids, target, { uid: true });
        } finally {
          lock.release();
        }
        return;
      }
    }
  });
}

/** Permanently delete a message from the IMAP server (best-effort). */
export async function imapDeletePermanent(messageId: string): Promise<void> {
  if (!messageId) return;
  await withImapClient(async (client) => {
    for (const box of SEARCH_MAILBOXES) {
      const uids = await findUidByMessageId(client, box, messageId);
      if (uids.length) {
        const lock = await client.getMailboxLock(box);
        try {
          await client.messageDelete(uids, { uid: true });
        } finally {
          lock.release();
        }
      }
    }
  });
}

/** Append a sent message to the Sent folder on the IMAP server (best-effort). */
export async function imapAppendSent(opts: {
  fromAlias: string;
  fromName?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
}): Promise<void> {
  await withImapClient(async (client) => {
    const list = (await client.list()) as Array<{
      path: string;
      name: string;
      specialUse?: string;
    }>;
    const sent =
      list.find(
        (l) => l.specialUse === "\\Sent" || /^sent$/i.test(l.name) || /sent/i.test(l.path),
      )?.path;
    if (!sent) return;
    const fromName = opts.fromName ?? "ביג-שווק";
    const lines = [
      `From: "${fromName}" <${opts.fromAlias}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Date: ${new Date().toUTCString()}`,
      ...(opts.messageId ? [`Message-ID: ${opts.messageId}`] : []),
      `MIME-Version: 1.0`,
      `Content-Type: text/${opts.html ? "html" : "plain"}; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      opts.html ?? opts.text ?? "",
    ];
    const raw = lines.join("\r\n");
    try {
      await client.append(sent, raw, ["\\Seen"]);
    } catch (e: any) {
      console.warn("[imap-op] append-sent failed", e?.message ?? e);
    }
  });
}

export function startMailPoller(intervalMs = 5 * 60 * 1000) {
  const cfg = getImapConfig();
  if (!cfg.user || !cfg.pass) {
    console.log("[mail] IMAP not configured, poller disabled");
    return;
  }
  // Kick off once after 10s, then every interval.
  setTimeout(() => {
    syncIncomingMail().catch((e) => console.error("[mail] initial sync error", e));
    setInterval(() => {
      syncIncomingMail().catch((e) => console.error("[mail] poll error", e));
    }, intervalMs);
  }, 10_000);
}
