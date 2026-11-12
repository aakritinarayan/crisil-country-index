"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "@/components/ui/icons";

/** The closing band on every public page: the methodology introduction and the
 *  disclaimer on one dark surface (no site footer: the embedding host provides its
 *  own). Not shown on /methodology, which carries the full disclaimer itself and
 *  needs no link to itself. usePathname is safe here — unlike useSearchParams it
 *  does not push the markup out of the static HTML. */
export function ClosingSection({ disclaimer }: { disclaimer: string }) {
  if (usePathname().startsWith("/methodology")) return null;
  return (
    <section aria-labelledby="method-h" className="closing">
      <div aria-hidden className="closing-grid" />
      <div className="wrap relative">
        <div className="flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="min-w-0 max-w-[620px]">
            <p className="text-[13px] text-[var(--muted)]">How the index works</p>
            <h2 id="method-h" className="mt-1.5 text-[clamp(1.6rem,2.6vw,2.125rem)] font-semibold leading-tight tracking-[-0.02em] text-white">How the scores are built</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">Understand the framework, scoring approach and evidence behind the Country Index.</p>
          </div>
          <Link href="/methodology" className="hero-btn hero-btn-primary closing-cta shrink-0 self-start !h-12 md:self-auto">Explore methodology<span className="box" aria-hidden><ArrowUpRight size={16} /></span></Link>
        </div>
        {/* Disclaimer slot — always present (CLAUDE.md), text from meta.disclaimer */}
        <div className="border-t border-[var(--line)] py-6">
          <h3 className="text-[12px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">Disclaimer</h3>
          <p className="mt-1.5 max-w-[90ch] text-[13px] leading-relaxed text-[var(--ink-2)]">{disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
