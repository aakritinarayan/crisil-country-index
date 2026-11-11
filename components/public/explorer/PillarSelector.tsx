"use client";
import { useEffect, useRef, useState } from "react";
import { COMPOSITE, useExplorer } from "./ExplorerContext";

const OVERVIEW = "__overview";

/** Assessment tabs ("Colour map by", a screen-reader group label): Overview, the
 *  workbook's composite (when enabled), then every pillar by its workbook name. Plain text
 *  tabs, muted when inactive, with a 2px teal underline on the active one. Native radios,
 *  so arrow keys move between options. Labels never wrap or truncate: if they need more
 *  room than the toolbar has, only this tab strip scrolls sideways (with soft edge fades),
 *  and the active tab is kept in view. */
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

  // keep the active tab visible (scrollLeft only: scrollIntoView would move the page)
  useEffect(() => {
    const r = row.current;
    const el = r?.querySelector<HTMLElement>("input:checked")?.parentElement;
    if (!r || !el) return;
    if (el.offsetLeft < r.scrollLeft) r.scrollLeft = el.offsetLeft - 24;
    else if (el.offsetLeft + el.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = el.offsetLeft + el.offsetWidth - r.clientWidth + 24;
  }, [current]);

  const fade = (on: boolean, side: "l" | "r") =>
    <span aria-hidden className={`pointer-events-none absolute inset-y-0 w-8 transition-opacity ${side === "l" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"} from-[var(--explore-bg)] to-transparent ${on ? "opacity-100" : "opacity-0"}`} />;

  return (
    <div className="relative min-w-0">
      <span id="colour-by" className="sr-only">Colour map by</span>
      <div ref={row} role="radiogroup" aria-labelledby="colour-by" className="flex h-12 flex-nowrap items-stretch gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => (
          <label key={o.id} className="relative flex shrink-0 cursor-pointer">
            <input type="radio" name="measure" value={o.id} checked={current === o.id}
              onChange={() => (o.id === OVERVIEW ? showOverview() : setMeasure(o.id))} className="peer sr-only" />
            <span className="relative inline-flex items-center whitespace-nowrap text-[13.5px] text-muted transition-colors hover:text-ink
              after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:scale-x-0 after:bg-[var(--teal)] after:transition-transform after:duration-200
              peer-checked:font-medium peer-checked:text-ink peer-checked:after:scale-x-100
              peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">{o.name}</span>
          </label>
        ))}
      </div>
      {fade(edges.start, "l")}
      {fade(edges.end, "r")}
    </div>
  );
}
