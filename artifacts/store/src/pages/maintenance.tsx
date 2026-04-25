import { useQuery } from "@tanstack/react-query";
import { Wrench, Mail, Phone, ShieldCheck, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function MaintenancePage() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return {} as Record<string, string>;
      return res.json();
    },
  });

  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const [, setLocation] = useLocation();

  const message =
    settings?.maintenance_message ||
    "אנו מבצעים עבודות תחזוקה קצרות. נשוב בקרוב!";

  const previewLiveSite = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("adminPreviewSite", "1");
    window.location.reload();
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
    >
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 md:p-12 text-center">
        <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg">
          <Wrench className="h-12 w-12 text-white animate-pulse" />
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-3">
          האתר בתחזוקה
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-2">ביג-שווק</p>
        <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded-full mb-6" />

        <p className="text-base md:text-lg text-slate-700 leading-relaxed mb-8 whitespace-pre-line">
          {message}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-6 text-right space-y-3">
          <h2 className="font-bold text-slate-900 mb-2">
            צריכים אותנו בדחיפות?
          </h2>
          <a
            href="mailto:support@bigshook.com"
            className="flex items-center gap-3 text-blue-700 hover:text-blue-900 transition-colors"
          >
            <Mail className="h-5 w-5 shrink-0" />
            <span dir="ltr">support@bigshook.com</span>
          </a>
          <a
            href="tel:+972771234577"
            className="flex items-center gap-3 text-blue-700 hover:text-blue-900 transition-colors"
          >
            <Phone className="h-5 w-5 shrink-0" />
            <span dir="ltr">077-1234577</span>
          </a>
        </div>

        {isAdmin && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold mb-4">
              <ShieldCheck className="h-4 w-4" />
              מזוהה כמנהל
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => setLocation("/admin")}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                data-testid="button-go-admin"
              >
                <LayoutDashboard className="h-4 w-4" />
                מעבר למרכז הניהול
              </button>
              <button
                type="button"
                onClick={previewLiveSite}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                data-testid="button-preview-site"
              >
                צפה באתר כמנהל (טאב זה בלבד)
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-400">
          תודה על הסבלנות — נחזור לפעילות בהקדם
        </p>
      </div>
    </div>
  );
}
