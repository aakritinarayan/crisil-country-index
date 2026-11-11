"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./icons";

export type SelectOption = {
  value: string;
  label: string;
  /** right-aligned secondary text, e.g. a count */
  meta?: string;
  /** small text after the label, e.g. a score range */
  hint?: string;
  /** a colour cue shown before the label */
  swatch?: string;
  disabled?: boolean;
};

/** A compact select (WAI-ARIA "select-only combobox"): a button showing its label and
 *  value, and an anchored listbox that opens 6px below it — never over it — or above when
 *  there is no room, kept inside the viewport. On narrow screens the list is a bottom
 *  sheet. Keyboard: Enter/Space/↓ open; ↑ ↓ Home End move; Enter/Space choose; Escape or
 *  Tab close, focus returns to the trigger. Choosing closes the list. */
export function Select({ label, value, options, onChange, className = "", minMenuWidth = 0, active = false }: {
  label: string; value: string; options: SelectOption[]; onChange: (v: string) => void;
  className?: string; minMenuWidth?: number; active?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; sheet: boolean } | null>(null);
  const current = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const place = useCallback(() => {
    const t = trigger.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 640) { setPos({ top: 0, left: 0, width: vw, up: false, sheet: true }); return; }
    const width = Math.min(Math.max(r.width, minMenuWidth), vw - 16);
    const h = Math.min(list.current?.scrollHeight ?? 320, 360);
    const up = vh - r.bottom < h + 14 && r.top > vh - r.bottom;
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left, width, up, sheet: false });
  }, [minMenuWidth]);

  const openMenu = (at?: number) => {
    const sel = options.findIndex((o) => o.value === value);
    setHi(at ?? (sel >= 0 ? sel : enabled[0] ?? 0));
    setOpen(true);
  };
  const close = (refocus = true) => { setOpen(false); setPos(null); if (refocus) trigger.current?.focus(); };
  const choose = (i: number) => { const o = options[i]; if (!o || o.disabled) return; onChange(o.value); close(); };

  // measured after the list renders (hidden until placed), so it opens in the right spot
  useLayoutEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) close(false);
    };
    const onMove = () => place();
    // Escape closes from anywhere (e.g. the pointer opened it while focus was elsewhere)
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && e.target !== trigger.current) { e.preventDefault(); close(); } };
    document.addEventListener("keydown", onEsc);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { document.removeEventListener("keydown", onEsc); document.removeEventListener("pointerdown", onDoc); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, place]);
  // keep the highlighted option in view
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, hi]);

  const step = (d: 1 | -1) => {
    const k = enabled.indexOf(hi);
    setHi(enabled[Math.min(enabled.length - 1, Math.max(0, (k < 0 ? 0 : k) + d))]);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); setHi(enabled[0]); }
    else if (e.key === "End") { e.preventDefault(); setHi(enabled[enabled.length - 1]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(hi); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };

  const menu = open && (
    <>
      {pos?.sheet && <div aria-hidden className="fixed inset-0 z-[70] bg-[var(--scrim)]" onPointerDown={() => close(false)} />}
      <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}
        className={`sel-menu fixed z-[71] overflow-auto py-1 ${pos?.sheet ? "is-sheet inset-x-0 bottom-0 max-h-[70dvh] pb-4" : "max-h-[360px]"}`}
        style={pos && !pos.sheet ? { top: pos.top, left: pos.left, width: pos.width, transform: pos.up ? "translateY(-100%)" : undefined } : pos ? undefined : { visibility: "hidden" }}>
        {pos?.sheet && <li aria-hidden className="px-4 pb-2 pt-3 text-[12.5px] font-medium text-muted">{label}</li>}
        {options.map((o, i) => {
          const sel = o.value === value;
          return (
            <li key={o.value} id={`${id}-o${i}`} data-i={i} role="option" aria-selected={sel} aria-disabled={o.disabled || undefined}
              onPointerEnter={() => !o.disabled && setHi(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => choose(i)}
              className={`sel-option flex items-center gap-2.5 px-3 ${pos?.sheet ? "min-h-12" : "min-h-10"} ${i === hi ? "is-hi" : ""} ${o.disabled ? "opacity-45" : "cursor-pointer"}`}>
              <span aria-hidden className="grid w-4 shrink-0 place-items-center text-[var(--teal)]">{sel && <Check size={15} />}</span>
              {o.swatch && <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: o.swatch }} />}
              <span className={`min-w-0 flex-1 truncate text-[14px] ${sel ? "font-semibold text-ink" : "text-ink-2"}`}>
                {o.label}{o.hint && <span className="ml-1.5 font-normal text-muted num">{o.hint}</span>}
              </span>
              {o.meta && <span className="shrink-0 text-[12.5px] text-muted num">{o.meta}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span id={`${id}-label`} className="shrink-0 text-[13px] text-muted">{label}</span>
      <button ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`} aria-activedescendant={open ? `${id}-o${hi}` : undefined}
        onClick={() => (open ? close() : openMenu())} onKeyDown={onKey}
        className={`sel-trigger field flex h-11 min-w-0 flex-1 items-center gap-2 bg-raised pl-3 pr-2.5 text-left text-[14px] ${open ? "is-open" : ""} ${active ? "is-active" : ""}`}>
        {current?.swatch && <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: current.swatch }} />}
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate text-ink">{current?.label ?? "Select"}</span>
        <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" && menu && createPortal(menu, document.body)}
    </div>
  );
}
