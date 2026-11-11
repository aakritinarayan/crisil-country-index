import Link from "next/link";
import { ArrowUpRight } from "@/components/ui/icons";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { formatAsOf } from "@/lib/bands";
import { SiteHeader } from "@/components/public/SiteHeader";

const showSampleBanner = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const snapshot = await getPublishedSnapshot();
  const summary = snapshot ? summarise(snapshot) : null;
  const options = summary?.countries.map(({ country_id, name, slug, iso_code, composite_score, rank }) => ({ country_id, name, slug, iso_code, composite_score, rank })) ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>
      <SiteHeader countries={options} sample={showSampleBanner} />

      <main id="main" className="flex-1">{children}</main>

      {/* The closing section: the methodology preview and the footer on one dark surface
          (hero grid, warm light at the lower edge). Same on every page. */}
      <footer className="site-footer">
        <div aria-hidden className="site-footer-grid" />
        <div className="wrap relative">
          {/* footer introduction: text left, CTA right (stacked on phones) */}
          <section aria-labelledby="method-h" className="flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between md:gap-10 md:py-14">
            <div className="min-w-0 max-w-[620px]">
              <p className="text-[13px] text-[var(--muted)]">How the index works</p>
              <h2 id="method-h" className="mt-1.5 text-[clamp(1.6rem,2.6vw,2.125rem)] font-semibold leading-tight tracking-[-0.02em] text-white">How the scores are built</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">Understand the framework, scoring approach and evidence behind the Country Index.</p>
            </div>
            <Link href="/methodology" className="hero-btn hero-btn-primary footer-cta shrink-0 self-start !h-12 md:self-auto">Explore methodology<span className="box" aria-hidden><ArrowUpRight size={16} /></span></Link>
          </section>

          <div className="grid gap-8 border-t border-[var(--line)] py-10 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.8fr)] md:gap-12">
            <div>
              <p className="text-[16px] font-semibold text-white">Country Index</p>
              {summary && <p className="mt-1 text-[13.5px] text-[var(--muted)]">Data as of {formatAsOf(summary.meta.as_of)}</p>}
            </div>
            <nav aria-labelledby="footer-explore">
              <p id="footer-explore" className="text-[12px] uppercase tracking-[0.08em] text-[var(--muted)]">Explore</p>
              <ul className="mt-2.5 grid gap-1.5 text-[14.5px]">
                <li><Link href="/" className="footer-link">Overview</Link></li>
                <li><Link href="/#map" className="footer-link">Map</Link></li>
                <li><Link href="/#rankings" className="footer-link">Rankings</Link></li>
                <li><Link href="/methodology" className="footer-link">Methodology</Link></li>
              </ul>
            </nav>
            {/* Disclaimer slot — always present, text from meta.disclaimer. */}
            <section aria-labelledby="disclaimer-h" className="sm:col-span-2 md:col-span-1">
              <h2 id="disclaimer-h" className="text-[12px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">Disclaimer</h2>
              <p className="mt-2.5 max-w-[68ch] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                {summary?.meta.disclaimer ?? "This index is not a credit rating."}
              </p>
            </section>
          </div>
          {showSampleBanner && (
            <p className="border-t border-[var(--line)] py-5 text-[13px] font-medium text-[var(--ink-2)]">Sample data — not a Crisil assessment</p>
          )}
        </div>
      </footer>
    </div>
  );
}
