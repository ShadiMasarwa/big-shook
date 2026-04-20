import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    account: text("account").notNull(),
    direction: text("direction", { enum: ["incoming", "outgoing"] })
      .notNull()
      .default("incoming"),
    folder: text("folder", {
      enum: ["inbox", "sent", "archive", "spam", "trash"],
    })
      .notNull()
      .default("inbox"),
    fromName: text("from_name"),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html"),
    department: text("department"),
    isRead: boolean("is_read").notNull().default(false),
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    threadId: text("thread_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    accountIdx: index("messages_account_idx").on(t.account),
    folderIdx: index("messages_folder_idx").on(t.folder),
    isReadIdx: index("messages_is_read_idx").on(t.isRead),
    receivedIdx: index("messages_received_idx").on(t.receivedAt),
    messageIdIdx: index("messages_message_id_idx").on(t.messageId),
  }),
);

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

export const MESSAGE_ACCOUNTS = [
  "support@bigshook.com",
  "info@bigshook.com",
  "suppliers@bigshook.com",
  "admin@bigshook.com",
] as const;

export const MESSAGE_DEPARTMENT_TO_ACCOUNT: Record<string, string> = {
  customer_service: "support@bigshook.com",
  info: "info@bigshook.com",
  suppliers: "suppliers@bigshook.com",
  admin: "admin@bigshook.com",
};
