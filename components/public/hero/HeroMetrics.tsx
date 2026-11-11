"use client";
import { useId, useState } from "react";
import { useExplorer } from "../explorer/ExplorerContext";
import { enterExplorer } from "./enter-explorer";

export type HeroMetricData = {
  count: number;
  average: { value: string; n: number } | null; // null: composite disabled or unavailable
  top: { id: string; name: string; score: string; tied: number } | null;
};

/** Three live metrics in the dark hero: editorial numerals, hairline dividers, no cards. */
export function HeroMetrics({ count, average, top }: HeroMetricData) {
  const { select } = useExplorer();
  const [explain, setExplain] = useState(false);
  const tipId = useId();
  const cell = "relative flex min-w-0 flex-col items-center px-3 py-4 text-center sm:px-6";
  const value = "text-[30px] font-semibold leading-none tracking-tight text-[var(--h-ink)] num sm:text-[38px]";
  const label = "mt-2.5 text-[12.5px] text-[var(--h-muted)] sm:text-[13px]";
  const hit = "hero-metric outline-none";

  return (
    <dl className="grid grid-cols-2 border-y border-[var(--h-line-strong)] sm:grid-cols-3">
      <div className={`${cell} border-r border-[var(--h-line-strong)]`}>
        <dt className="order-2"><span className={label}>Countries assessed</span></dt>
        <dd className="order-1">
          <a href="#map" onClick={(e) => { e.preventDefault(); enterExplorer(); }} className={`${hit} ${value} block`}
            aria-label={`${count} countries assessed. Explore them on the map`}>{count}</a>
        </dd>
      </div>

      <div className={`${cell} border-[var(--h-line-strong)] sm:border-r`}>
        <dt className="order-2"><span className={label}>Average score</span></dt>
        <dd className="order-1">
          {average ? (
            <span className="group relative inline-block">
              <button type="button" className={`${hit} ${value}`} aria-describedby={tipId} aria-expanded={explain}
                onClick={() => setExplain((v) => !v)} onBlur={() => setExplain(false)}>
                {average.value}
              </button>
              <span id={tipId} role="tooltip"
                className={`absolute bottom-full left-1/2 z-10 mb-3 w-60 -translate-x-1/2 border border-[var(--h-line-strong)] bg-[#0b1112] px-3 py-2 text-left text-[12.5px] leading-snug text-[var(--h-muted)] shadow-lg
                  ${explain ? "visible opacity-100" : "invisible opacity-0"} transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100`}>
                The simple mean of the {average.n} published composite scores, rounded to one decimal place.
              </span>
            </span>
          ) : <span className={`${value} text-[var(--h-muted)]`}>—</span>}
        </dd>
        {!average && <dd className="mt-1 text-[11.5px] text-[var(--h-muted)]">Composite not published</dd>}
      </div>

      <div className={`${cell} col-span-2 border-t border-[var(--h-line-strong)] sm:col-span-1 sm:border-t-0`}>
        <dt className="order-2"><span className={label}>Top performer</span></dt>
        <dd className="order-1">
          {top ? (
            <button type="button" onClick={() => { select(top.id); enterExplorer(); }} className={`${hit} ${value} max-w-full text-balance !text-[24px] sm:!text-[30px] lg:!text-[34px]`}
              aria-label={`Top performer: ${top.name}, composite ${top.score}${top.tied ? `, tied with ${top.tied} other${top.tied > 1 ? "s" : ""}` : ""}. Show on the map`}>
              {top.name} <span className="text-[var(--h-accent)]">· {top.score}</span>
              {top.tied > 0 && <span className="ml-1 align-middle text-[14px] font-normal text-[var(--h-muted)]">+{top.tied}</span>}
            </button>
          ) : <span className={`${value} text-[var(--h-muted)]`}>—</span>}
        </dd>
        {!top && <dd className="mt-1 text-[11.5px] text-[var(--h-muted)]">Composite not published</dd>}
      </div>
    </dl>
  );
}
