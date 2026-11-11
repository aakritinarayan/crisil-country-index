import Link from "next/link";
import { ArrowUpRight } from "@/components/ui/icons";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { formatAsOf } from "@/lib/bands";
import { SiteHeader } from "@/components/public/SiteHeader";
import { FooterGlow } from "@/components/public/FooterGlow";

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
        <FooterGlow />
        <div className="wrap relative">
          <section aria-labelledby="method-h" className="max-w-[1000px] pb-[clamp(3.5rem,8vw,6rem)] pt-[clamp(5rem,11vw,8.5rem)]">
            <p className="text-[clamp(1.05rem,1.6vw,1.35rem)] text-[var(--ink-2)]">How the index works</p>
            <h2 id="method-h" className="mt-3 text-[clamp(2.4rem,6vw,4.75rem)] font-bold leading-[1] tracking-[-0.035em] text-white">How the scores are built</h2>
            <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-[var(--ink-2)] sm:text-[17px]">
              Understand the framework, scoring approach and evidence behind the Country Index.
            </p>
            <Link href="/methodology" className="hero-btn hero-btn-primary footer-cta mt-8">Explore methodology<span className="box" aria-hidden><ArrowUpRight size={16} /></span></Link>
          </section>

          <div className="grid gap-10 border-t border-[var(--line)] pb-[clamp(7rem,14vw,11rem)] pt-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.6fr)]">
            <div>
              <p className="text-[17px] font-bold text-white">Country Index</p>
              {summary && <p className="mt-1.5 text-[14px] text-[var(--muted)]">Data as of {formatAsOf(summary.meta.as_of)}</p>}
            </div>
            <nav aria-labelledby="footer-explore">
              <p id="footer-explore" className="text-[12px] uppercase tracking-[0.08em] text-[var(--muted)]">Explore</p>
              <ul className="mt-3 grid gap-2.5 text-[15px]">
                <li><Link href="/" className="footer-link">Overview</Link></li>
                <li><Link href="/#map" className="footer-link">Map</Link></li>
                <li><Link href="/#rankings" className="footer-link">Rankings</Link></li>
                <li><Link href="/methodology" className="footer-link">Methodology</Link></li>
              </ul>
            </nav>
            {/* Disclaimer slot — always present, text from meta.disclaimer. */}
            <section aria-labelledby="disclaimer-h">
              <h2 id="disclaimer-h" className="text-[12px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">Disclaimer</h2>
              <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
                {summary?.meta.disclaimer ?? "This index is not a credit rating."}
              </p>
            </section>
          </div>
          {showSampleBanner && (
            <p className="absolute inset-x-4 bottom-8 text-[clamp(1rem,1.8vw,1.35rem)] text-[rgb(241_244_242/0.82)] sm:inset-x-0">Sample data — not a Crisil assessment</p>
          )}
        </div>
      </footer>
    </div>
  );
}
