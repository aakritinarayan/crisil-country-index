import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countryDetail, getPublishedSnapshot, showSampleNotice, summarise } from "@/lib/data";
import { getSiteSnapshot } from "@/lib/preview";
import { allBands, bandFor, fmtScore, formatAsOf } from "@/lib/bands";
import type { Reference } from "@/lib/types";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { CountryShape } from "@/components/public/explorer/CountryShape";
import { CountrySkeleton } from "@/components/public/country/CountrySkeleton";
import ALPHA2 from "@/data/iso-alpha3-to-alpha2.json";
import { PillarExplorer, type PillarRow } from "@/components/public/country/PillarExplorer";
import { NotPublished } from "@/components/public/NotPublished";
import { CompositeHistogram, HISTOGRAM_MIN_COUNTRIES } from "@/components/public/country/CompositeHistogram";
import { nCountries } from "@/lib/plural";

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
  const p = await getSiteSnapshot();
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

async function CountryProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getSiteSnapshot();
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
      kpis: detail.kpis?.byPillar[p.pillar_id],
    };
  });
  const period = formatAsOf(meta.as_of);
  const sample = showSampleNotice(meta);
  // flag from the 2-letter code (regional-indicator pair); decorative, the name carries meaning
  const a2 = (ALPHA2 as Record<string, string>)[country.iso_code];
  const flag = a2 ? String.fromCodePoint(...[...a2].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : null;

  return (
    <article>
      {/* ── compact summary header: identity, the numbers, one line, actions; map card right ── */}
      <header className="country-hero">
        <div aria-hidden className="country-hero-grid" />
        <div className="wrap relative grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-12 lg:py-10">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-[13px]">
              <ol className="flex flex-wrap items-center gap-2 text-[rgb(232_239_236/0.6)]">
                <li><Link href="/#map" className="transition-colors hover:text-white">Explore countries</Link></li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-[rgb(232_239_236/0.9)]">{country.name}</li>
              </ol>
            </nav>
            <div className="mt-5 flex items-center gap-3.5">
              {flag && <span aria-hidden className="country-flag">{flag}</span>}
              <h1 className="text-[clamp(2rem,4vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">{country.name}</h1>
            </div>
            <p className="mt-2 text-[13px] text-[rgb(232_239_236/0.6)] num">
              <abbr title="ISO 3166-1 alpha-3 code" className="no-underline">{country.iso_code}</abbr><span aria-hidden> · </span>Reporting period {period}
              {sample && <><span aria-hidden> · </span>Sample data — not a Crisil assessment</>}
            </p>

            {showComposite && compositeBand ? (
              <dl className="mt-6 flex flex-wrap items-end gap-x-9 gap-y-4">
                <div>
                  <dt className="text-[12.5px] text-[rgb(232_239_236/0.6)]">Composite score</dt>
                  <dd className="mt-1 flex items-center gap-2.5">
                    <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-white num">{fmtScore(country.composite_score!)}</span>
                    <span className="hero-chip" style={{ "--chip": compositeBand.fill } as React.CSSProperties}>{compositeBand.label}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[12.5px] text-[rgb(232_239_236/0.6)]">Global rank</dt>
                  <dd className="mt-1 text-[22px] font-semibold text-white num"><Link href="/#rankings" className="transition-colors hover:text-[#9fe3d6]">#{me.rank}<span className="text-[14px] font-normal text-[rgb(232_239_236/0.6)]"> of {composites.length}</span></Link></dd>
                </div>
                {compositeMedian != null && (
                  <div>
                    <dt className="text-[12.5px] text-[rgb(232_239_236/0.6)]">Index median</dt>
                    <dd className="mt-1 text-[22px] font-semibold text-white num">{fmtScore(compositeMedian)}</dd>
                  </div>
                )}
              </dl>
            ) : <p className="mt-6 text-[14.5px] text-[rgb(232_239_236/0.75)]">No composite score is published for {country.name}.</p>}

            {takeaway && <p className="mt-5 max-w-[64ch] text-[15px] leading-relaxed text-[rgb(232_239_236/0.8)]">{takeaway}</p>}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/?select=${encodeURIComponent(country.country_id)}#map`} className="hero-btn hero-btn-primary !h-11 !min-w-0">View on map<span className="box" aria-hidden><ArrowRight size={15} /></span></Link>
            </div>
          </div>

          {/* the country alone, floating on the hero ground (no card, no map) */}
          <Link href={`/?select=${encodeURIComponent(country.country_id)}#map`} aria-label={`Show ${country.name} on the world map`}
            className="country-float mx-auto hidden aspect-square w-full max-w-[340px] sm:block lg:-my-6 lg:max-w-none">
            <CountryShape iso={country.iso_code} name={country.name} fill="" variant="float" />
          </Link>
        </div>
      </header>

      <div className="wrap">
        {/* ── against the index ── */}
        {showComposite && compositeBand && (
          <section aria-labelledby="bench-h" className="py-10">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <div>
                <h2 id="bench-h" className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Against the index</h2>
                <p className="mt-1 text-[14px] text-muted">Composite scores of every country in the index.</p>
              </div>
              <p className="text-[14px] text-ink-2 num">Higher than <strong className="font-semibold text-ink">{Math.round((below / composites.length) * 100)}%</strong> of {nCountries(composites.length)}</p>
            </div>
            <div className="mt-6">
              {composites.length >= HISTOGRAM_MIN_COUNTRIES
                ? <CompositeHistogram values={composites} score={country.composite_score!} median={compositeMedian} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} countryName={country.name} />
                : <p className="text-[14px] text-muted">Too few countries are published for a distribution; rank {me.rank} of {composites.length}.</p>}
            </div>
          </section>
        )}

        <PillarExplorer key={country.country_id} rows={rows} min={meta.score_min} max={meta.score_max} legend={allBands(meta.score_bands).map((b) => ({ label: b.label, min: b.min, max: b.max, fill: b.fill }))}
          kpiScale={detail.kpis ? { levels: detail.kpis.levels, max: detail.kpis.max } : undefined} />

        {/* ── continue exploring ── */}
        <section id="explore" aria-labelledby="explore-more-h" className="scroll-mt-4 border-t border-line py-12">
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
