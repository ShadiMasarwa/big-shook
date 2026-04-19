import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, Tag } from "lucide-react";

type Suggestion = {
  products: { id: number; nameHe: string; slug: string; image: string | null }[];
  tags: string[];
};

interface SearchSuggestProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  inputId: string;
  inputClassName?: string;
  testId?: string;
  variant?: "desktop" | "mobile";
}

export function SearchSuggest({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputId,
  inputClassName,
  testId,
  variant = "desktop",
}: SearchSuggestProps) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<Suggestion>({ products: [], tags: [] });
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setData({ products: [], tags: [] });
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
        setActiveIdx(-1);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const items: { type: "product" | "tag"; label: string; href: string; image?: string | null }[] = [
    ...data.products.map((p) => ({
      type: "product" as const,
      label: p.nameHe,
      href: `/product/${p.id}`,
      image: p.image,
    })),
    ...data.tags.map((t) => ({
      type: "tag" as const,
      label: t,
      href: `/catalog?q=${encodeURIComponent(t)}`,
    })),
  ];

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const it = items[activeIdx];
      setOpen(false);
      navigate(it.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && value.trim().length >= 2 && items.length > 0;

  return (
    <div ref={wrapRef} className="relative flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit();
        }}
        className="flex relative w-full"
        role="search"
      >
        <label htmlFor={inputId} className="sr-only">{placeholder ?? "חיפוש"}</label>
        <input
          id={inputId}
          type="search"
          placeholder={placeholder}
          className={inputClassName}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          data-testid={testId}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${inputId}-listbox`}
        />
        <button
          type="submit"
          className={variant === "desktop" ? "absolute right-3 top-1/2 -translate-y-1/2" : "shrink-0 px-3"}
          aria-label="חפש"
        >
          <Search className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" aria-hidden="true" />
        </button>
      </form>

      {showDropdown && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-50 right-0 left-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-96 overflow-y-auto"
          dir="rtl"
        >
          {data.products.length > 0 && (
            <li className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground bg-muted">מוצרים</li>
          )}
          {data.products.map((p, idx) => {
            const i = idx;
            return (
              <li key={`p-${p.id}`} role="option" aria-selected={activeIdx === i}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/product/${p.id}`);
                  }}
                  className={`w-full text-right flex items-center gap-3 px-3 py-2 hover:bg-muted ${activeIdx === i ? "bg-muted" : ""}`}
                  data-testid={`suggest-product-${p.id}`}
                >
                  <div className="w-10 h-10 bg-white rounded border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Search className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{p.nameHe}</span>
                </button>
              </li>
            );
          })}
          {data.tags.length > 0 && (
            <li className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground bg-muted border-t border-border">תגיות</li>
          )}
          {data.tags.map((t, idx) => {
            const i = data.products.length + idx;
            return (
              <li key={`t-${t}`} role="option" aria-selected={activeIdx === i}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/catalog?q=${encodeURIComponent(t)}`);
                  }}
                  className={`w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-muted ${activeIdx === i ? "bg-muted" : ""}`}
                  data-testid={`suggest-tag-${t}`}
                >
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{t}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
