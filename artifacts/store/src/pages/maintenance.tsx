import { useQuery } from "@tanstack/react-query";
import { Wrench, Mail, Phone } from "lucide-react";

export default function MaintenancePage() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return {} as Record<string, string>;
      return res.json();
    },
  });

  const message =
    settings?.maintenance_message ||
    "אנו מבצעים עבודות תחזוקה קצרות. נשוב בקרוב!";

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
        <p className="text-lg md:text-xl text-slate-600 mb-2">
          ביג-שווק
        </p>
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

        <p className="mt-8 text-xs text-slate-400">
          תודה על הסבלנות — נחזור לפעילות בהקדם
        </p>
      </div>
    </div>
  );
}
