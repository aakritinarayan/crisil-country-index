import Link from "next/link";
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

      <footer className="site-footer mt-24">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="font-bold text-ink">Country Index</p>
            {summary && <p className="mt-2 text-sm text-muted">Data as of {formatAsOf(summary.meta.as_of)}</p>}
            {showSampleBanner && <p className="mt-3 text-sm font-semibold text-ink">Sample data — not a Crisil assessment</p>}
            <nav aria-label="Footer" className="mt-5 flex flex-col gap-2 text-sm">
              <Link href="/" className="text-ink-2 hover:text-ink">Overview</Link>
              <Link href="/methodology" className="text-ink-2 hover:text-ink">Methodology</Link>
            </nav>
          </div>
          {/* Disclaimer slot — always present, text from meta.disclaimer. */}
          <section aria-labelledby="disclaimer-h">
            <h2 id="disclaimer-h" className="label text-muted">Disclaimer</h2>
            <p className="mt-3 max-w-[75ch] text-sm leading-relaxed text-ink-2">
              {summary?.meta.disclaimer ?? "This index is not a credit rating."}
            </p>
          </section>
        </div>
      </footer>
    </div>
  );
}
