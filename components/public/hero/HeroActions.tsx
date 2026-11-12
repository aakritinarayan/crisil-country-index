"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { useExplorer } from "../explorer/ExplorerContext";
import { Globe } from "../explorer/Globe";
import { enterExplorer } from "./enter-explorer";

/** Primary CTA. A real #map link, so it works before hydration and without JS. */
export function ExploreCta() {
  return (
    <a href="#map" onClick={(e) => { e.preventDefault(); enterExplorer(); }} className="hero-btn hero-btn-primary">
      Explore countries<span className="box" aria-hidden><ArrowRight size={16} /></span>
    </a>
  );
}

export function MethodologyCta() {
  return <Link href="/methodology" className="hero-btn hero-btn-ghost">About methodology</Link>;
}

/** Below lg only: the hero's own decorative half-globe (photographic, intro mode). On lg
 *  and up the explorer's globe takes this place (see ExploreWorkspace). */
export function HeroHalfGlobe() {
  const { summary } = useExplorer();
  const items = useMemo(() => summary.countries.map((c) => ({ id: c.country_id, iso: c.iso_code, name: c.name, value: null })), [summary.countries]);
  return (
    <div className="hero-half relative h-[clamp(300px,74vw,460px)] overflow-hidden lg:hidden" style={{ "--photo": 1 } as React.CSSProperties}>
      <div className="absolute left-1/2 top-[clamp(24px,6vw,48px)] aspect-square w-[clamp(600px,158vw,980px)] -translate-x-1/2">
        <Globe items={items} bands={summary.meta.score_bands} neutral activeBands={null} selectedId={null} onSelect={() => {}}
          mode="intro" onActivate={enterExplorer} label="Explore countries on the globe" photo />
      </div>
      <a href="#map" onClick={(e) => { e.preventDefault(); enterExplorer(); }} className="hero-scroll absolute bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
        <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v15M6 13l6 6 6-6" /></svg><span className="sr-only">Scroll to explore the world</span>
      </a>
    </div>
  );
}
