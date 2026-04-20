import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
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
    tls: { rejectUnauthorized: false },
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
}): Promise<{ messageId: string }> {
  const transporter = getMailTransporter();
  if (!transporter) throw new Error("SMTP not configured");
  const fromName = opts.fromName ?? "ביג-שווק";
  const info = await transporter.sendMail({
    from: `"${fromName}" <${opts.fromAlias}>`,
    sender: getSmtpConfig().user!,
    replyTo: opts.fromAlias,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references ?? undefined,
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
    tls: { rejectUnauthorized: false },
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
            bodyHtml: parsed.html ? String(parsed.html).slice(0, 200000) : null,
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
