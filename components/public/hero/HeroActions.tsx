"use client";
import Link from "next/link";
import { ArrowRight } from "@/components/ui/icons";
import { HeroGlobe } from "./HeroGlobe";
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

export function Globe(props: { assessed: string[]; highlight?: string; links: string[] }) {
  return <HeroGlobe {...props} onActivate={enterExplorer} label="Explore the interactive world map" />;
}
