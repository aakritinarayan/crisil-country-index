"use client";
import { useId, useMemo, useState } from "react";
import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";
import { Search } from "@/components/ui/icons";

export type CountryOption = { country_id: string; name: string; slug: string; iso_code: string; composite_score: number | null; rank: number };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Accessible country search (ARIA 1.2 combobox). Matches name or ISO code. */
export function CountryCombobox({
  countries, bands, onSelect, autoFocus, placeholder = "Find a country", className = "", size = "md", showCount = true,
}: {
  countries: CountryOption[]; bands: ScoreBand[]; onSelect: (c: CountryOption) => void;
  autoFocus?: boolean; placeholder?: string; className?: string; size?: "md" | "lg" | "toolbar"; showCount?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    const starts = countries.filter((c) => norm(c.name).startsWith(n) || c.iso_code.toLowerCase() === n);
    const rest = countries.filter((c) => !starts.includes(c) && norm(c.name).includes(n));
    return [...starts, ...rest].slice(0, 8);
  }, [q, countries]);

  const pick = (c: CountryOption) => { onSelect(c); setQ(""); setOpen(false); };
  const showList = open && q.trim().length > 0;

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={`${id}-in`} className="sr-only">{placeholder}</label>
      <div className={`field flex items-center gap-3 bg-raised px-4 ${size === "lg" ? "h-14" : size === "toolbar" ? "h-12" : "h-11"}`}>
        <Search className="shrink-0 text-muted" />
        <input
          id={`${id}-in`} role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${id}-o${active}` : undefined}
          autoFocus={autoFocus} autoComplete="off" spellCheck={false} placeholder={placeholder} value={q}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
            else if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
          }}
        />
        {showCount && <span className="hidden text-xs text-muted sm:inline num">{countries.length} countries</span>}
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label="Countries" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto border border-line bg-raised py-1 shadow-lift">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">No country matches “{q}”. Try another spelling or the ISO code.</li>}
          {results.map((c, i) => {
            const b = c.composite_score != null ? bandFor(c.composite_score, bands) : null;
            return (
              <li key={c.country_id} id={`${id}-o${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? "bg-sunken" : ""}`}>
                <span className="w-9 text-[11px] font-semibold tracking-wider text-muted">{c.iso_code}</span>
                <span className="flex-1 truncate font-medium text-ink">{c.name}</span>
                {b && c.composite_score != null && (
                  <span className="chip text-[13px]" style={{ "--chip-fill": b.fill, "--chip-ink": b.ink } as React.CSSProperties}>
                    <span className="n">{fmtScore(c.composite_score)}</span><span className="l">{b.label}</span>
                  </span>
                )}
                <span className="w-10 text-right text-xs text-muted num">#{c.rank}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
