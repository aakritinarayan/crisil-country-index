import Link from "next/link";
import { getPublishedSnapshot, summarise } from "@/lib/data";
import { formatAsOf } from "@/lib/bands";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { HeaderSearch } from "@/components/public/HeaderSearch";

const showSampleBanner = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const snapshot = await getPublishedSnapshot();
  const summary = snapshot ? summarise(snapshot) : null;
  const options = summary?.countries.map(({ country_id, name, slug, iso_code, composite_score, rank }) => ({ country_id, name, slug, iso_code, composite_score, rank })) ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>
      {showSampleBanner && (
        <div role="note" className="bg-[var(--banner-bg)] px-4 py-2 text-center text-[13px] font-semibold text-[var(--banner-ink)]">
          Sample data — not a Crisil assessment
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="wrap flex h-16 items-center gap-4">
          {/* No client branding until the brand kit is approved (CONTEXT §7). */}
          <Link href="/" className="mr-auto flex items-center gap-2.5 font-bold tracking-tight text-ink">
            <span aria-hidden className="relative size-7">
              <span className="absolute inset-0 rounded-full bg-[var(--brand)]" />
              <span className="absolute inset-y-0 left-3 right-[-6px] rounded-full bg-[var(--teal)] mix-blend-multiply dark:mix-blend-normal" />
            </span>
            Country Index
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 text-[15px] md:flex">
            <Link href="/#map" className="px-3 py-2 text-ink-2 hover:text-ink">Map</Link>
            <Link href="/#rankings" className="px-3 py-2 text-ink-2 hover:text-ink">Rankings</Link>
            <Link href="/methodology" className="px-3 py-2 text-ink-2 hover:text-ink">Methodology</Link>
          </nav>
          {summary && <HeaderSearch countries={options} bands={summary.meta.score_bands} />}
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-line bg-raised">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="font-bold text-ink">Country Index</p>
            {summary && <p className="mt-2 text-sm text-muted">Data as of {formatAsOf(summary.meta.as_of)}</p>}
            <nav aria-label="Footer" className="mt-5 flex flex-col gap-2 text-sm">
              <Link href="/" className="text-ink-2 hover:text-ink">Overview</Link>
              <Link href="/methodology" className="text-ink-2 hover:text-ink">Methodology</Link>
            </nav>
          </div>
          {/* Disclaimer slot — always present, text from meta.disclaimer. */}
          <section aria-labelledby="disclaimer-h">
            <h2 id="disclaimer-h" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Disclaimer</h2>
            <p className="mt-3 max-w-[75ch] text-sm leading-relaxed text-ink-2">
              {summary?.meta.disclaimer ?? "This index is not a credit rating."}
            </p>
          </section>
        </div>
      </footer>
    </div>
  );
}
