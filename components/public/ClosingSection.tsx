"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "@/components/ui/icons";

/** The closing card on every public page: the methodology introduction on a dark,
 *  inset surface (no site footer: the embedding host provides its own). Not shown on
 *  /methodology, which needs no link to itself; that page carries the full disclaimer.
 *  usePathname is safe here — unlike useSearchParams it does not push the markup out
 *  of the static HTML. */
export function ClosingSection() {
  if (usePathname().startsWith("/methodology")) return null;
  return (
    <div className="wrap pb-[clamp(2rem,4vw,3rem)]">
      <section aria-labelledby="method-h" className="closing">
        <div aria-hidden className="closing-grid" />
        <div className="relative flex flex-col gap-6 px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between md:gap-10 md:py-12 lg:px-14">
          <div className="min-w-0 max-w-[620px]">
            <p className="text-[13px] text-[var(--muted)]">How the index works</p>
            <h2 id="method-h" className="mt-1.5 text-[clamp(1.6rem,2.6vw,2.125rem)] font-semibold leading-tight tracking-[-0.02em] text-white">How the scores are built</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">Understand the framework, scoring approach and evidence behind the Country Index.</p>
          </div>
          <Link href="/methodology" className="hero-btn hero-btn-primary closing-cta shrink-0 self-start !h-12 md:self-auto">Explore methodology<span className="box" aria-hidden><ArrowUpRight size={16} /></span></Link>
        </div>
      </section>
    </div>
  );
}
