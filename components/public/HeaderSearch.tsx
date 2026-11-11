"use client";
import { forwardRef, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Close, Search } from "@/components/ui/icons";
import type { CountryOption } from "./CountryCombobox";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Ranked matches: exact name, ISO code, name prefix, word prefix, then anywhere. */
export function matchCountries(countries: CountryOption[], query: string, max = 8) {
  const n = norm(query);
  if (!n) return [];
  const score = (c: CountryOption) => {
    const name = norm(c.name), iso = c.iso_code.toLowerCase();
    if (name === n) return 0;
    if (iso === n) return 1;
    if (name.startsWith(n)) return 2;
    if (name.split(/[\s\-'(),]+/).some((w) => w.startsWith(n))) return 3;
    if (name.includes(n)) return 4;
    if (n.length >= 2 && iso.startsWith(n)) return 5;
    return -1;
  };
  return countries.map((c) => ({ c, s: score(c) })).filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.c.name.localeCompare(b.c.name)).slice(0, max).map((x) => x.c);
}

export type HeaderSearchHandle = { focus: () => void };

/** Global country search (ARIA 1.2 combobox): typing suggests, nothing navigates until the
 *  visitor chooses. Enter opens the highlighted suggestion, or the top one if none is
 *  highlighted; a click opens it straight away. Arrow keys move the highlight, Escape
 *  closes the list (a second Escape clears the text). Profiles use the published slug. */
export const HeaderSearch = forwardRef<HeaderSearchHandle, { countries: CountryOption[]; className?: string; onNavigate?: () => void }>(
  function HeaderSearch({ countries, className = "", onNavigate }, ref) {
    const id = useId();
    const router = useRouter();
    const input = useRef<HTMLInputElement>(null);
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1); // -1: nothing highlighted yet
    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

    const results = useMemo(() => matchCountries(countries, q), [countries, q]);
    const showList = open && q.trim().length > 0;

    const go = (c: CountryOption) => {
      setOpen(false); setQ(""); setActive(-1);
      input.current?.blur();
      onNavigate?.();
      router.push(`/country/${c.slug}`);
    };

    return (
      <div className={`hd-search relative ${className}`}>
        <label htmlFor={`${id}-in`} className="sr-only">Find a country</label>
        <div className="hd-field flex h-10 items-center gap-2 px-3">
          <Search size={16} className="shrink-0 opacity-70" />
          <input
            ref={input} id={`${id}-in`} role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 && results[active] ? `${id}-o${active}` : undefined}
            autoComplete="off" spellCheck={false} placeholder="Find a country" value={q}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { const c = results[active >= 0 ? active : 0]; if (c) { e.preventDefault(); go(c); } }
              else if (e.key === "Escape") { e.preventDefault(); if (showList) setOpen(false); else if (q) setQ(""); else input.current?.blur(); }
            }}
          />
          {q ? (
            <button type="button" onClick={() => { setQ(""); setActive(-1); input.current?.focus(); }} aria-label="Clear search" className="grid size-6 shrink-0 place-items-center opacity-70 hover:opacity-100"><Close size={14} /></button>
          ) : (
            <kbd aria-hidden className="hd-kbd hidden px-1.5 text-[11px] lg:inline">/</kbd>
          )}
        </div>
        {showList && (
          <ul id={`${id}-list`} role="listbox" aria-label="Countries" className="absolute right-0 top-full z-40 mt-1.5 max-h-[60vh] w-full min-w-[300px] overflow-auto border border-line bg-raised py-1 text-ink shadow-lift">
            {results.length === 0 && <li className="px-4 py-3 text-[13.5px] text-muted">No country matches “{q.trim()}”.</li>}
            {results.map((c, i) => (
              <li key={c.country_id} id={`${id}-o${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); go(c); }}
                className={`hd-option flex cursor-pointer items-center gap-3 border-l-2 px-3.5 py-2.5 ${i === active ? "border-[var(--teal)] bg-sunken" : "border-transparent hover:bg-sunken/60"}`}>
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug">{c.name}</span>
                <span className="shrink-0 text-[11.5px] font-medium tracking-wide text-muted">{c.iso_code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
