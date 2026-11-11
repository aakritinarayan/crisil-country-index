import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countryDetail, getPublishedSnapshot, summarise } from "@/lib/data";
import { allBands, bandFor, fmtScore, formatAsOf } from "@/lib/bands";
import type { Reference } from "@/lib/types";
import { ArrowLeft, ArrowRight, ChevronDown } from "@/components/ui/icons";
import { CountryShape } from "@/components/public/explorer/CountryShape";
import { CountryInsights, type PillarRow } from "@/components/public/country/CountryInsights";
import { SectionNav } from "@/components/public/country/SectionNav";
import { NotPublished } from "@/components/public/NotPublished";
import { ShareButton } from "@/components/public/country/ShareButton";
import { CompositeHistogram, HISTOGRAM_MIN_COUNTRIES } from "@/components/public/country/CompositeHistogram";

/* Country profile. Everything here is derived from the published snapshot: pillar
 * order, band labels and edges, the scale, rank, medians and neighbours. Nothing is
 * keyed to a particular country or pillar. */

// Every published country is prerendered. With cacheComponents on, generateStaticParams
// must return at least one entry, so an unpublished index yields a placeholder slug
// that renders the "not published" state.
const UNPUBLISHED = "__unpublished";
export async function generateStaticParams() {
  const p = await getPublishedSnapshot();
  return p && p.countries.length ? p.countries.map((c) => ({ slug: c.slug })) : [{ slug: UNPUBLISHED }];
}

export async function generateMetadata({ params }: PageProps<"/country/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublishedSnapshot();
  const c = p?.countries.find((x) => x.slug === slug);
  if (!p || !c) return { title: "Country not found" };
  return { title: `${c.name} · ${p.meta.index_name}`, description: c.summary.slice(0, 160) || undefined };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const safeUrl = (u: string) => /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
const fmtDate = (d: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

// params are read inside <Suspense>, so a client navigation can paint the skeleton
// at once. Direct visits still get the fully prerendered page for every slug.
export default function CountryPage({ params }: PageProps<"/country/[slug]">) {
  return <Suspense fallback={<CountrySkeleton />}><CountryProfile params={params} /></Suspense>;
}

function CountrySkeleton() {
  return (
    <div className="wrap pt-8 sm:pt-10" aria-busy="true" aria-label="Loading country profile">
      <div className="h-4 w-48 bg-sunken" />
      <div className="mt-10 h-14 w-72 max-w-full bg-sunken" />
      <div className="mt-6 h-4 w-56 bg-sunken" />
      <div className="mt-12 grid gap-10 border-t border-line pt-12 lg:grid-cols-[360px_1fr]">
        <div className="h-64 bg-sunken" />
        <div className="grid content-start gap-3"><div className="h-5 bg-sunken" /><div className="h-5 bg-sunken" /><div className="h-5 w-2/3 bg-sunken" /></div>
      </div>
    </div>
  );
}

async function CountryProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getPublishedSnapshot();
  if (!snapshot || slug === UNPUBLISHED) return <NotPublished />;
  const detail = countryDetail(snapshot, slug);
  if (!detail) notFound();

  const { meta, pillars, countries } = summarise(snapshot);
  const { country } = detail;
  const me = countries.find((c) => c.country_id === country.country_id)!;
  const scoreOf = new Map(detail.scores.map((s) => [s.pillar_id, s]));
  const scored = pillars.filter((p) => scoreOf.has(p.pillar_id));
  const showComposite = meta.show_composite && country.composite_score != null;
  const compositeBand = showComposite ? bandFor(country.composite_score!, meta.score_bands) : null;
  const medians = Object.fromEntries(pillars.map((p) => [p.pillar_id, median(countries.map((c) => c.scores[p.pillar_id]).filter((v) => v != null))]).filter(([, v]) => v != null).map(([k, v]) => [k, round1(v as number)]));
  const composites = countries.map((c) => c.composite_score).filter((v): v is number => v != null);
  const compositeMedian = composites.length ? round1(median(composites)!) : null;
  const below = showComposite ? composites.filter((v) => v < country.composite_score!).length : 0;

  // Strongest / weakest only when they are distinct and unambiguous.
  const sorted = [...scored].sort((a, b) => me.scores[b.pillar_id] - me.scores[a.pillar_id]);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  const distinct = sorted.length > 1 && me.scores[top.pillar_id] !== me.scores[bottom.pillar_id];
  const strongest = distinct && me.scores[sorted[1].pillar_id] !== me.scores[top.pillar_id] ? top : undefined;
  const weakest = distinct && me.scores[sorted[sorted.length - 2].pillar_id] !== me.scores[bottom.pillar_id] ? bottom : undefined;

  // One factual sentence from the published numbers; nothing else is said.
  const takeaway = (() => {
    const parts: string[] = [];
    if (showComposite && compositeMedian != null) {
      const d = round1(country.composite_score! - compositeMedian);
      parts.push(d === 0 ? `${country.name}'s composite score equals the index median` : `${country.name}'s composite score is ${fmtScore(Math.abs(d))} points ${d > 0 ? "above" : "below"} the index median`);
    }
    if (strongest && weakest) parts.push(`its highest pillar is ${strongest.name} (${fmtScore(me.scores[strongest.pillar_id])}) and its lowest ${weakest.name} (${fmtScore(me.scores[weakest.pillar_id])})`);
    if (!parts.length) return scored.length ? `${country.name} has published scores on ${scored.length} of ${pillars.length} pillars.` : null;
    const t = parts.join("; ");
    return t.charAt(0).toUpperCase() + t.slice(1) + ".";
  })();

  // Navigation: neighbours in the composite ranking, and the closest pillar profiles.
  const at = countries.findIndex((c) => c.country_id === country.country_id);
  const prev = at > 0 ? countries[at - 1] : null;
  const next = at < countries.length - 1 ? countries[at + 1] : null;
  const similar = countries
    .filter((c) => c.country_id !== country.country_id)
    .map((c) => {
      const shared = scored.filter((p) => c.scores[p.pillar_id] != null);
      const d = shared.length ? Math.sqrt(shared.reduce((t, p) => t + (c.scores[p.pillar_id] - me.scores[p.pillar_id]) ** 2, 0) / shared.length) : Infinity;
      return { c, d };
    })
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);

  const rows: PillarRow[] = pillars.map((p) => {
    const sc = scoreOf.get(p.pillar_id);
    const b = sc ? bandFor(sc.score, meta.score_bands) : null;
    return {
      id: p.pillar_id, name: p.name, description: p.description ?? "",
      score: sc?.score ?? null, median: medians[p.pillar_id] ?? null,
      band: b ? { label: b.label, min: b.min, max: b.max, fill: b.fill } : null,
      rationale: sc?.rationale ?? "",
      references: (sc?.references ?? []).map((r: Reference) => ({ title: r.title, publisher: r.publisher, date: fmtDate(r.published_date), url: safeUrl(r.url) })),
    };
  });
  const pct = (v: number) => ((v - meta.score_min) / (meta.score_max - meta.score_min)) * 100;
  const period = formatAsOf(meta.as_of);
  const sample = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";

  return (
    <article>
      {/* ── hero: identity, composite, rank and the country itself ── */}
      <header data-header-tone="dark" className="country-hero">
        <div className="wrap grid gap-10 pb-12 pt-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center lg:gap-14 lg:pb-16">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-[13.5px]">
              <ol className="flex flex-wrap items-center gap-2 text-[rgb(232_239_236/0.62)]">
                <li><Link href="/#map" className="hover:text-white hover:underline hover:underline-offset-4">Explore countries</Link></li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-white">{country.name}</li>
              </ol>
            </nav>
            <p className="mt-8 text-[13px] uppercase tracking-[0.08em] text-[rgb(232_239_236/0.62)] num">
              <abbr title="ISO 3166-1 alpha-3 code" className="no-underline">{country.iso_code}</abbr><span aria-hidden> · </span>Reporting period {period}
            </p>
            <h1 className="mt-2 text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1] tracking-[-0.035em] text-white">{country.name}</h1>
            {sample && <p className="mt-3 inline-block border border-white/15 px-2 py-0.5 text-[12px] text-[rgb(232_239_236/0.75)]">Sample data — not a Crisil assessment</p>}

            {showComposite && compositeBand ? (
              <dl className="mt-8 grid grid-cols-[auto_auto] gap-x-10 gap-y-5 sm:grid-cols-[auto_auto_auto] sm:items-end">
                <div>
                  <dt className="text-[13px] text-[rgb(232_239_236/0.62)]">Composite score</dt>
                  <dd className="mt-1 flex items-end gap-3">
                    <span className="text-[64px] font-semibold leading-[.85] tracking-[-0.04em] text-white num">{fmtScore(country.composite_score!)}</span>
                    <span className="pb-1 text-[15px] font-semibold text-white"><span aria-hidden className="mr-1.5 inline-block size-2.5" style={{ background: compositeBand.fill }} />{compositeBand.label}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-[rgb(232_239_236/0.62)]">Global rank</dt>
                  <dd className="mt-1 text-[22px] font-semibold text-white num"><Link href="/#rankings" className="hover:underline hover:underline-offset-4">{me.rank}<span className="text-[15px] font-normal text-[rgb(232_239_236/0.62)]"> of {composites.length}</span></Link></dd>
                </div>
                {compositeMedian != null && (
                  <div>
                    <dt className="text-[13px] text-[rgb(232_239_236/0.62)]">Index median</dt>
                    <dd className="mt-1 text-[22px] font-semibold text-white num">{fmtScore(compositeMedian)}</dd>
                  </div>
                )}
              </dl>
            ) : <p className="mt-8 text-[15px] text-[rgb(232_239_236/0.75)]">No composite score is published for {country.name}.</p>}

            {takeaway && <p className="mt-7 max-w-[60ch] text-[16.5px] leading-relaxed text-[rgb(232_239_236/0.82)]">{takeaway}</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/?select=${encodeURIComponent(country.country_id)}#map`} className="hero-btn hero-btn-primary">View on map<span className="box" aria-hidden><ArrowRight size={16} /></span></Link>
              <ShareButton title={`${country.name} · ${meta.index_name}`} path={`/country/${country.slug}`} />
            </div>
          </div>
          <Link href={`/?select=${encodeURIComponent(country.country_id)}#map`} aria-label={`Show ${country.name} on the world map`} className="country-hero-shape mx-auto block aspect-square w-full max-w-[300px] lg:max-w-none">
            <CountryShape iso={country.iso_code} name={country.name} fill="" variant="hero" />
          </Link>
        </div>
      </header>

      <SectionNav items={[{ id: "performance", label: "Performance" }, { id: "assessments", label: "Assessment details" }, { id: "explore", label: "Explore more" }]} />

      <div className="wrap">
        {/* ── composite benchmark: the country and the index median on one scale ── */}
        {showComposite && compositeBand && (
          <section aria-labelledby="bench-h" className="border-b border-line py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="bench-h" className="text-[20px] font-bold tracking-[-0.02em] text-ink">Against the index</h2>
              <p className="text-[13.5px] text-ink-2 num">Higher than <strong className="font-semibold text-ink">{Math.round((below / composites.length) * 100)}%</strong> of {composites.length} countries</p>
            </div>
            <div role="img" className="relative mt-8 pb-10" aria-label={`Composite ${fmtScore(country.composite_score!)} (${compositeBand.label}) on a ${meta.score_min}–${meta.score_max} scale; index median ${compositeMedian != null ? fmtScore(compositeMedian) : "not available"}.`}>
              <div aria-hidden className="flex h-2.5 gap-px">
                {allBands(meta.score_bands).map((b) => <span key={b.label} title={`${b.label} ${b.min}–${b.max}`} style={{ flex: b.max - b.min + 1, background: b.fill, opacity: b.index === compositeBand.index ? 1 : 0.5 }} />)}
              </div>
              <span aria-hidden className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(country.composite_score!)}%` }}>
                <span className="text-[12.5px] font-semibold text-ink num">{country.name} {fmtScore(country.composite_score!)}</span>
                <span className="mt-0.5 h-5 w-[3px] bg-ink" />
              </span>
              {compositeMedian != null && (
                <span aria-hidden className="absolute top-[-2px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(compositeMedian)}%` }}>
                  <span className="h-4 w-0 border-l-2 border-dashed border-muted" />
                  <span className="mt-1 whitespace-nowrap text-[12px] text-muted num">Median {fmtScore(compositeMedian)}</span>
                </span>
              )}
              <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between text-[11.5px] text-muted num"><span>{meta.score_min}</span><span>{meta.score_max}</span></div>
            </div>
            {composites.length >= HISTOGRAM_MIN_COUNTRIES && (
              <details className="group mt-2">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold text-link [&::-webkit-details-marker]:hidden">
                  <ChevronDown size={14} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />Show the full distribution
                </summary>
                <div className="mt-5 max-w-[760px]">
                  <CompositeHistogram values={composites} score={country.composite_score!} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} countryName={country.name} />
                </div>
              </details>
            )}
          </section>
        )}

        <CountryInsights rows={rows} min={meta.score_min} max={meta.score_max} />

        {/* ── continue exploring ── */}
        <section id="explore" aria-labelledby="explore-more-h" className="scroll-mt-32 border-t border-line py-12">
          <h2 id="explore-more-h" className="text-[24px] font-bold tracking-[-0.02em] text-ink">Continue exploring</h2>
          <nav aria-label="Ranked neighbours" className="mt-6 grid gap-px border-y border-line sm:grid-cols-2">
            {prev ? (
              <Link href={`/country/${prev.slug}`} className="group flex items-center gap-3 py-4 pr-4 hover:bg-sunken/60">
                <ArrowLeft size={16} className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" />
                <span><span className="block text-[12.5px] text-muted num">{meta.show_composite ? `Ranked above · #${prev.rank}` : "Previous"}</span><span className="block text-[15.5px] font-semibold text-ink">{prev.name}</span></span>
              </Link>
            ) : <span className="hidden sm:block" />}
            {next && (
              <Link href={`/country/${next.slug}`} className="group flex items-center justify-end gap-3 py-4 pl-4 text-right hover:bg-sunken/60">
                <span><span className="block text-[12.5px] text-muted num">{meta.show_composite ? `Ranked below · #${next.rank}` : "Next"}</span><span className="block text-[15.5px] font-semibold text-ink">{next.name}</span></span>
                <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </nav>

          {similar.length > 0 && (
            <div className="mt-8">
              <h3 className="text-[15px] font-semibold text-ink">Closest pillar profiles</h3>
              <p className="mt-1 text-[13px] text-muted">Countries whose pillar scores differ least from {country.name}&apos;s on average.</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {similar.map(({ c }) => (
                  <li key={c.country_id}>
                    <Link href={`/country/${c.slug}`} className="group inline-flex items-baseline gap-1.5 text-[14.5px] text-ink hover:text-link">
                      <span className="group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                      {meta.show_composite && c.composite_score != null && <span className="text-[12.5px] text-muted num">{fmtScore(c.composite_score)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href="/#rankings" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-link underline decoration-1 underline-offset-4">Back to country rankings</Link>
        </section>
      </div>
    </article>
  );
}
