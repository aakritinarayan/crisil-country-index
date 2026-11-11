"use client";
import { useEffect, useRef, useState } from "react";
import { COMPOSITE, useExplorer } from "./ExplorerContext";

const OVERVIEW = "__overview";

/** "Colour map by": one row of segments — Overview, the workbook's composite (when
 *  enabled), then every pillar. Native radios, so arrow keys move between options.
 *  The row never wraps: on narrow screens it scrolls sideways, with edge fades that
 *  show there is more, and the checked option is kept in view. */
export function PillarSelector() {
  const { summary, overview, showOverview, measure, setMeasure } = useExplorer();
  const options = [
    { id: OVERVIEW, name: "Overview" },
    ...(summary.meta.show_composite ? [{ id: COMPOSITE, name: "Composite" }] : []),
    ...summary.pillars.map((p) => ({ id: p.pillar_id, name: p.name })),
  ];
  const current = overview ? OVERVIEW : measure;
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", update); };
  }, []);

  // keep the checked segment visible when it changes (arrow keys, or a deep link)
  useEffect(() => {
    // scrollLeft only: scrollIntoView would also scroll the page vertically on load
    const r = row.current;
    const el = r?.querySelector<HTMLElement>("input:checked")?.parentElement;
    if (!r || !el) return;
    if (el.offsetLeft < r.scrollLeft) r.scrollLeft = el.offsetLeft - 24;
    else if (el.offsetLeft + el.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = el.offsetLeft + el.offsetWidth - r.clientWidth + 24;
  }, [current]);

  const fade = (on: boolean, side: "l" | "r") =>
    <span aria-hidden className={`pointer-events-none absolute inset-y-0 w-10 transition-opacity ${side === "l" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"} from-bg to-transparent ${on ? "opacity-100" : "opacity-0"}`} />;

  return (
    <div role="radiogroup" aria-labelledby="colour-by" className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
      <span id="colour-by" className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Colour map by</span>
      <div className="relative min-w-0 flex-1">
        <div ref={row} className="flex flex-nowrap gap-1.5 overflow-x-auto py-1 [scrollbar-width:thin]">
          {options.map((o) => (
            <label key={o.id} className="relative shrink-0 cursor-pointer">
              <input type="radio" name="measure" value={o.id} checked={current === o.id}
                onChange={() => (o.id === OVERVIEW ? showOverview() : setMeasure(o.id))} className="peer sr-only" />
              <span className="inline-flex h-9 items-center whitespace-nowrap border border-line-strong bg-raised px-3.5 text-[13.5px] font-medium text-ink-2
                hover:border-[var(--teal)] hover:text-ink
                peer-checked:border-[var(--seg-on-bg)] peer-checked:bg-[var(--seg-on-bg)] peer-checked:font-semibold peer-checked:text-[var(--seg-on-ink)]
                peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                {o.name}
              </span>
            </label>
          ))}
        </div>
        {fade(edges.start, "l")}
        {fade(edges.end, "r")}
      </div>
    </div>
  );
}
