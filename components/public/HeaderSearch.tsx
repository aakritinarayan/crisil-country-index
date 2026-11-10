"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoreBand } from "@/lib/types";
import { Close, Search } from "@/components/ui/icons";
import { CountryCombobox, type CountryOption } from "./CountryCombobox";

/** "Find a country" in the header: a button that opens a search dialog (also / or Ctrl/⌘ K). */
export function HeaderSearch({ countries, bands }: { countries: CountryOption[]; bands: ScoreBand[] }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2.5 border border-line-strong bg-raised px-3 text-sm text-muted hover:shadow-soft sm:w-56">
        <Search size={17} /><span className="hidden sm:inline">Find a country</span>
        <kbd className="ml-auto hidden border border-line px-1.5 text-[11px] sm:inline">/</kbd>
        <span className="sr-only sm:hidden">Find a country</span>
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)} aria-label="Find a country"
        className="m-0 mx-auto mt-[12vh] w-[min(640px,calc(100%-32px))] max-w-none bg-transparent p-0 backdrop:bg-[var(--scrim)]"
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open && (
          <div className="border border-line bg-bg p-4 shadow-lift">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Find a country</p>
              <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center text-muted hover:text-ink" aria-label="Close search"><Close /></button>
            </div>
            <CountryCombobox countries={countries} bands={bands} autoFocus size="lg"
              onSelect={(c) => { setOpen(false); router.push(`/country/${c.slug}`); }} />
            <p className="mt-3 text-xs text-muted">Search by name or ISO code, e.g. “IND”.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
