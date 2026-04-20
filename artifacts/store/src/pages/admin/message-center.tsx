import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox, Send, Archive, AlertTriangle, Trash2, RefreshCw,
  Search, Reply, ArrowRight, Mail, MailOpen,
} from "lucide-react";

const ACCOUNTS = [
  { value: "all", label: "כל תיבות הדואר", color: "bg-slate-500" },
  { value: "support@bigshook.com", label: "שירות לקוחות", color: "bg-blue-500" },
  { value: "info@bigshook.com", label: "מידע", color: "bg-emerald-500" },
  { value: "suppliers@bigshook.com", label: "ספקים", color: "bg-amber-500" },
  { value: "admin@bigshook.com", label: "הנהלה", color: "bg-rose-500" },
] as const;

const FOLDERS = [
  { value: "inbox", label: "תיבת דואר נכנס", icon: Inbox },
  { value: "sent", label: "נשלחו", icon: Send },
  { value: "archive", label: "ארכיון", icon: Archive },
  { value: "spam", label: "ספאם", icon: AlertTriangle },
  { value: "trash", label: "אשפה", icon: Trash2 },
] as const;

type Msg = {
  id: number;
  account: string;
  direction: "incoming" | "outgoing";
  folder: string;
  fromName: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  isRead: boolean;
  receivedAt: string;
};

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const days = Math.floor(h / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return d.toLocaleDateString("he-IL");
}

export default function MessageCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [account, setAccount] = useState<string>("all");
  const [folder, setFolder] = useState<string>("inbox");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const listKey = ["admin-messages", account, folder, search];
  const { data: list, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const params = new URLSearchParams({ account, folder, search });
      const res = await fetch(`/api/admin/messages?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("שגיאה בטעינה");
      return (await res.json()) as { messages: Msg[] };
    },
    refetchInterval: 30000,
  });

  const { data: unread } = useQuery({
    queryKey: ["admin-messages-unread"],
    queryFn: async () => {
      const res = await fetch("/api/admin/messages/unread-count", { headers: authHeaders() });
      if (!res.ok) return { total: 0, byAccount: {} as Record<string, number> };
      return res.json() as Promise<{ total: number; byAccount: Record<string, number> }>;
    },
    refetchInterval: 30000,
  });

  const selected = useMemo(
    () => list?.messages.find((m) => m.id === selectedId) ?? null,
    [list, selectedId],
  );

  const { data: full } = useQuery({
    queryKey: ["admin-message", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/messages/${selectedId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("לא נמצא");
      return (await res.json()) as Msg;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-messages"] });
    qc.invalidateQueries({ queryKey: ["admin-messages-unread"] });
  }

  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: number; kind: "archive" | "spam" | "delete" | "restore" }) => {
      const url = `/api/admin/messages/${id}${kind === "delete" ? "" : `/${kind}`}`;
      const res = await fetch(url, {
        method: kind === "delete" ? "DELETE" : "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("פעולה נכשלה");
    },
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reply = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("בחר הודעה");
      const res = await fetch(`/api/admin/messages/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ body: replyBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שליחה נכשלה");
      }
    },
    onSuccess: () => {
      toast({ title: "התשובה נשלחה" });
      setReplyOpen(false); setReplyBody("");
      invalidate();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/messages/sync", { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("סנכרון נכשל");
      return res.json();
    },
    onSuccess: (r: any) => {
      toast({ title: `סונכרנו ${r.stored ?? 0} הודעות חדשות` });
      invalidate();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">מרכז הודעות</h1>
          <p className="text-sm text-muted-foreground">
            {unread?.total ? `${unread.total} הודעות שלא נקראו` : "כל ההודעות נקראו"}
          </p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending} variant="outline" data-testid="btn-sync-mail">
          <RefreshCw className={`h-4 w-4 ml-2 ${sync.isPending ? "animate-spin" : ""}`} />
          סנכרון מהשרת
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Sidebar: accounts + folders */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-card border border-border rounded-2xl p-3 overflow-y-auto">
          <div className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2">תיבות דואר</div>
          {ACCOUNTS.map((a) => {
            const cnt = a.value === "all"
              ? (unread?.total ?? 0)
              : (unread?.byAccount?.[a.value] ?? 0);
            const active = account === a.value;
            return (
              <button
                key={a.value}
                onClick={() => { setAccount(a.value); setSelectedId(null); }}
                className={`w-full text-right flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm mb-1 ${active ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"}`}
                data-testid={`acct-${a.value}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full ${a.color} shrink-0`} />
                  <span className="truncate">{a.label}</span>
                </span>
                {cnt > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}

          <div className="text-xs font-bold text-muted-foreground uppercase mb-2 mt-4 px-2">תיקיות</div>
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const active = folder === f.value;
            return (
              <button
                key={f.value}
                onClick={() => { setFolder(f.value); setSelectedId(null); }}
                className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-md text-sm mb-1 ${active ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"}`}
                data-testid={`folder-${f.value}`}
              >
                <Icon className="h-4 w-4" />
                {f.label}
              </button>
            );
          })}
        </aside>

        {/* Message list */}
        <section className="col-span-12 md:col-span-4 lg:col-span-4 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש בהודעות..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
                data-testid="input-message-search"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">טוען...</div>
            ) : !list?.messages.length ? (
              <div className="p-6 text-center text-muted-foreground">אין הודעות בתיקייה זו</div>
            ) : (
              list.messages.map((m) => {
                const acc = ACCOUNTS.find((a) => a.value === m.account);
                const isSel = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-right p-3 border-b border-border transition-colors ${isSel ? "bg-primary/10" : "hover:bg-muted"} ${!m.isRead ? "bg-blue-50/50" : ""}`}
                    data-testid={`message-row-${m.id}`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`h-2 w-2 mt-2 rounded-full shrink-0 ${acc?.color ?? "bg-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${!m.isRead ? "font-bold" : "font-medium"}`}>
                            {m.fromName || m.fromEmail}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{relTime(m.receivedAt)}</span>
                        </div>
                        <div className={`text-sm truncate ${!m.isRead ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                          {m.subject || "(ללא נושא)"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {m.bodyText.slice(0, 80)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Message viewer */}
        <section className="col-span-12 md:col-span-5 lg:col-span-6 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">
              <div>
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                בחר הודעה כדי להציג את התוכן
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{selected.subject || "(ללא נושא)"}</h2>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="md:hidden text-muted-foreground hover:text-foreground"
                    aria-label="סגור"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-sm">
                  <div><b>מאת:</b> {selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}</div>
                  <div><b>אל:</b> {selected.toEmail}</div>
                  <div className="text-xs text-muted-foreground">{new Date(selected.receivedAt).toLocaleString("he-IL")}</div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={() => { setReplyOpen(true); setReplyBody(""); }} data-testid="btn-reply">
                    <Reply className="h-4 w-4 ml-1" /> השב
                  </Button>
                  {folder !== "archive" && (
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: selected.id, kind: "archive" })} data-testid="btn-archive">
                      <Archive className="h-4 w-4 ml-1" /> ארכיון
                    </Button>
                  )}
                  {folder !== "spam" && (
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: selected.id, kind: "spam" })} data-testid="btn-spam">
                      <AlertTriangle className="h-4 w-4 ml-1" /> ספאם
                    </Button>
                  )}
                  {folder !== "inbox" && (
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: selected.id, kind: "restore" })}>
                      <Inbox className="h-4 w-4 ml-1" /> החזר לתיבה
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => action.mutate({ id: selected.id, kind: "delete" })}
                    data-testid="btn-delete"
                  >
                    <Trash2 className="h-4 w-4 ml-1" /> מחק
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {full?.bodyHtml ? (
                  <div className="prose prose-sm max-w-none" dir="rtl" dangerouslySetInnerHTML={{ __html: full.bodyHtml }} />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans" dir="rtl">{full?.bodyText ?? selected.bodyText}</pre>
                )}
              </div>
              {replyOpen && (
                <div className="border-t border-border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-2">
                    תשובה תישלח מ-<b>{selected.account}</b> אל <b>{selected.fromEmail}</b>
                  </div>
                  <textarea
                    rows={5}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="כתוב את תשובתך..."
                    className="w-full p-3 rounded-md border border-input bg-background text-sm resize-y"
                    data-testid="textarea-reply"
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setReplyOpen(false)}>ביטול</Button>
                    <Button size="sm" onClick={() => reply.mutate()} disabled={reply.isPending || !replyBody.trim()} data-testid="btn-send-reply">
                      {reply.isPending ? "שולח..." : "שלח תשובה"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
