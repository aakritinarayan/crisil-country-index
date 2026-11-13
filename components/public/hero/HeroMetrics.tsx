"use client";
import { enterExplorer } from "./enter-explorer";

export type HeroMetricData = {
  count: number;      // countries assessed
  pillars: number;    // assessment pillars
  asOf: string;       // the published reporting period, formatted
};

/** Three index-wide metrics in the dark hero, kept quiet so the headline and globe lead:
 *  modest numerals, small muted labels, hairline dividers, no cards. Deliberately nothing
 *  about any one country — the hero speaks for the whole (global) index. */
export function HeroMetrics({ count, pillars, asOf }: HeroMetricData) {
  const cell = "relative flex min-w-0 flex-col items-center px-3 py-3 text-center sm:px-5";
  const value = "text-[25px] font-medium leading-none tracking-tight text-[var(--h-ink)]/90 num sm:text-[30px]";
  const label = "mt-2 text-[12.5px] tracking-wide text-[var(--h-muted)] sm:text-[13.5px]";
  const hit = "hero-metric outline-none";

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3">
      <div className={`${cell} border-r border-white/[0.07]`}>
        <dt className="order-2"><span className={label}>Countries assessed</span></dt>
        <dd className="order-1">
          <a href="#map" onClick={(e) => { e.preventDefault(); enterExplorer(); }} className={`${hit} ${value} block`}
            aria-label={`${count} countries assessed. Explore them on the map`}>{count}</a>
        </dd>
      </div>

      <div className={`${cell} border-white/[0.07] sm:border-r`}>
        <dt className="order-2"><span className={label}>Assessment pillars</span></dt>
        <dd className="order-1">
          <a href="/methodology" className={`${hit} ${value} block`} aria-label={`${pillars} assessment pillars. Read the methodology`}>{pillars}</a>
        </dd>
      </div>

      {/* the data period: a figure beside the others from sm; on phones a small pill under them */}
      <div className={`${cell} hidden sm:flex`}>
        <dt className="order-2"><span className={label}>Data as of</span></dt>
        <dd className={`order-1 ${value} whitespace-nowrap`}>{asOf}</dd>
      </div>
      <div className="col-span-2 flex justify-center pt-4 sm:hidden">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] leading-none">
          <dt className="text-[var(--h-muted)]">Data as of</dt>
          <dd className="font-medium text-[var(--h-ink)]/90 num">{asOf}</dd>
        </div>
      </div>
    </dl>
  );
}
