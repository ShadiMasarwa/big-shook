import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Loader2, FileText } from "lucide-react";

const SLUG_MAP: Record<string, { key: string; title: string }> = {
  takanon:       { key: "page_takanon",       title: "תקנון" },
  delivery:      { key: "page_delivery",      title: "מדיניות הובלה" },
  privacy:       { key: "page_privacy",       title: "הגנת הפרטיות" },
  accessibility: { key: "page_accessibility", title: "נגישות" },
  cancellation:  { key: "page_cancellation",  title: "מדיניות ביטול עסקה" },
  loyalty:       { key: "page_loyalty",       title: "מועדון נאמנות" },
};

export default function InfoPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const meta = SLUG_MAP[slug];

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  if (!meta) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground text-lg">הדף לא נמצא</p>
        </div>
      </Layout>
    );
  }

  const html = settings?.[meta.key] ?? "";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl" dir="rtl">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-black">{meta.title}</h1>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : html ? (
          <div
            className="prose prose-sm max-w-none prose-headings:font-bold prose-a:text-primary"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-20" />
            <p>תוכן הדף טרם הוגדר.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
