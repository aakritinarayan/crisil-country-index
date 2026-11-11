import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countryDetail, getPublishedSnapshot, summarise } from "@/lib/data";
import { bandFor, fmtScore, formatAsOf } from "@/lib/bands";
import type { Reference } from "@/lib/types";
import { ArrowLeft, ArrowRight, ChevronDown } from "@/components/ui/icons";
import { NotPublished } from "@/components/public/NotPublished";
import { ShareButton } from "@/components/public/country/ShareButton";
import { PillarBars } from "@/components/public/country/PillarBars";
import { PillarRadar } from "@/components/public/country/PillarRadar";
import { AssessmentTools } from "@/components/public/country/AssessmentTools";
import { BandScale } from "@/components/public/country/BandScale";
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
  const compositeMedian = median(composites);

  // Strongest / weakest only when they are distinct and unambiguous.
  const sorted = [...scored].sort((a, b) => me.scores[b.pillar_id] - me.scores[a.pillar_id]);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  const distinct = sorted.length > 1 && me.scores[top.pillar_id] !== me.scores[bottom.pillar_id];
  const strongest = distinct && me.scores[sorted[1].pillar_id] !== me.scores[top.pillar_id] ? top : undefined;
  const weakest = distinct && me.scores[sorted[sorted.length - 2].pillar_id] !== me.scores[bottom.pillar_id] ? bottom : undefined;

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

  const period = formatAsOf(meta.as_of);

  return (
    <article className="wrap pt-8 sm:pt-10">
      {/* 1 · Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-[14px]">
        <ol className="flex flex-wrap items-center gap-2 text-muted">
          <li><Link href="/#map" className="text-link underline-offset-4 hover:underline">Explore countries</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-ink">{country.name}</li>
        </ol>
      </nav>

      {/* 2 · Identity and summary */}
      <header className="mt-8 border-b border-line pb-12">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
              <abbr title="ISO 3166-1 alpha-3 code" className="no-underline">{country.iso_code}</abbr>
              <span aria-hidden> · </span>{meta.index_name}
            </p>
            <h1 className="t-display mt-3 text-ink">{country.name}</h1>
            <p className="mt-4 text-[15px] text-ink-2">Reporting period <strong className="font-semibold text-ink">{period}</strong></p>
          </div>
          <ShareButton title={`${country.name} · ${meta.index_name}`} />
        </div>
        <h2 className="sr-only">Summary</h2>
        {country.summary
          ? <p className="mt-8 max-w-[68ch] whitespace-pre-line text-[19px] leading-[1.7] text-ink sm:text-[21px]">{country.summary}</p>
          : <p className="mt-8 text-[16px] text-muted">No summary has been published for {country.name}.</p>}
      </header>

      {/* 3 · Overall score and rank, only when the workbook enables a composite and this country has one */}
      {showComposite && compositeBand && (
        <section aria-labelledby="overall-h" className="grid gap-10 border-b border-line py-12 lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-16">
          <div className="border border-line bg-raised p-6">
            <h2 id="overall-h" className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Composite score</h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-[64px] font-bold leading-none tracking-tight text-ink num">{fmtScore(country.composite_score!)}</span>
              <span className="text-[15px] text-muted">/ {meta.score_max}</span>
            </p>
            <p className="mt-4 inline-flex px-2.5 py-1 text-[14px] font-semibold" style={{ background: compositeBand.fill, color: compositeBand.ink }}>{compositeBand.label}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[14px]">
              <div><dt className="text-muted">Rank</dt><dd className="mt-1 font-semibold text-ink num">{me.rank} <span className="font-normal text-muted">of {composites.length}</span></dd></div>
              {compositeMedian != null && <div><dt className="text-muted">Index median</dt><dd className="mt-1 font-semibold text-ink num">{fmtScore(round1(compositeMedian))}</dd></div>}
            </dl>
          </div>
          <div className="self-center">
            {composites.length >= HISTOGRAM_MIN_COUNTRIES
              ? <CompositeHistogram values={composites} score={country.composite_score!} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} countryName={country.name} />
              : <BandScale score={country.composite_score!} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} subject={`${country.name} composite score`} />}
          </div>
        </section>
      )}

      {/* 4 + 5 · Pillar performance, radar secondary */}
      <section aria-labelledby="perf-h" className="grid gap-12 border-b border-line py-12 lg:grid-cols-[1fr_minmax(300px,400px)] lg:gap-16">
        <div>
          <h2 id="perf-h" className="t-h3 text-ink">Pillar performance</h2>
          <p className="mt-2 max-w-[60ch] text-[15px] text-muted">All {pillars.length} pillars against the index median. Select a pillar to open its assessment.</p>
          <div className="mt-6">
            {scored.length
              ? <PillarBars pillars={pillars} scores={me.scores} medians={medians} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} strongest={strongest?.pillar_id} weakest={weakest?.pillar_id} />
              : <p className="text-muted">No pillar scores have been published for {country.name}.</p>}
          </div>
        </div>
        {scored.length >= 3 && (
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Pillar profile</h3>
            <div className="mt-4">
              <PillarRadar countryName={country.name} min={meta.score_min} max={meta.score_max}
                rows={scored.map((p) => ({ pillar: p.name, score: me.scores[p.pillar_id], median: medians[p.pillar_id] ?? null }))} />
            </div>
          </div>
        )}
      </section>

      {/* 6 · Detailed assessments */}
      <section aria-labelledby="assess-h" className="border-b border-line py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="assess-h" className="t-h3 text-ink">Detailed assessments</h2>
            <p className="mt-2 max-w-[60ch] text-[15px] text-muted">The rationale behind each pillar score, with its sources.</p>
          </div>
          {scored.length > 1 && <AssessmentTools containerId="assessments" />}
        </div>
        <div id="assessments" className="mt-6 border-t border-line-strong">
          {scored.map((p) => {
            const s = scoreOf.get(p.pillar_id)!;
            const b = bandFor(s.score, meta.score_bands);
            return (
              <details key={p.pillar_id} id={p.pillar_id} className="group scroll-mt-24 border-b border-line">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold text-ink sm:text-[19px]">{p.name}</span>
                    {p.description && <span className="mt-0.5 block text-[14px] text-muted">{p.description}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-right">
                      <span className="block text-[20px] font-semibold leading-none text-ink num">{fmtScore(s.score)}</span>
                      <span className="mt-1 flex items-center justify-end gap-1.5 text-[12.5px] text-muted">
                        <span className="inline-block size-2.5" style={{ background: b.fill, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .15)" }} aria-hidden />{b.label}
                      </span>
                    </span>
                    <span className="grid size-9 place-items-center border border-line-strong text-ink transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden><ChevronDown size={16} /></span>
                  </span>
                </summary>
                <div className="grid gap-8 pb-8 pt-1 md:grid-cols-[1fr_minmax(240px,320px)] md:gap-12">
                  <div>
                    <BandScale score={s.score} bands={meta.score_bands} min={meta.score_min} max={meta.score_max} subject={p.name} />
                    <h3 className="sr-only">Rationale</h3>
                    {s.rationale
                      ? <p className="mt-6 max-w-[70ch] whitespace-pre-line text-[16px] leading-[1.75] text-ink-2">{s.rationale}</p>
                      : <p className="mt-6 text-muted">No rationale has been published for this score.</p>}
                  </div>
                  <References refs={s.references} />
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* 7 · Navigation */}
      <nav aria-label="More countries" className="py-12">
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {[{ c: prev, dir: "Previous", label: "Ranked above" }, { c: next, dir: "Next", label: "Ranked below" }].map(({ c, dir, label }) => c ? (
            <Link key={dir} href={`/country/${c.slug}`} className={`group flex items-center gap-4 bg-bg p-5 hover:bg-raised ${dir === "Next" ? "sm:flex-row-reverse sm:text-right" : ""}`}>
              <span className="grid size-10 shrink-0 place-items-center border border-line-strong text-ink group-hover:border-ink">{dir === "Next" ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}</span>
              <span>
                <span className="block text-[13px] text-muted">{meta.show_composite ? `${label} · #${c.rank}` : `${dir} country`}</span>
                <span className="block text-[17px] font-semibold text-ink">{c.name}</span>
              </span>
            </Link>
          ) : <div key={dir} className="hidden bg-bg sm:block" />)}
        </div>

        {similar.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Similar pillar profiles</h2>
            <ul className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {similar.map(({ c }) => {
                const v = meta.show_composite ? c.composite_score : null;
                const b = v != null ? bandFor(v, meta.score_bands) : null;
                return (
                  <li key={c.country_id} className="bg-bg">
                    <Link href={`/country/${c.slug}`} className="flex h-full items-center justify-between gap-3 p-4 hover:bg-raised">
                      <span>
                        <span className="block font-semibold text-ink">{c.name}</span>
                        <span className="text-[13px] text-muted">{c.iso_code}</span>
                      </span>
                      {v != null && b && (
                        <span className="text-right">
                          <span className="block font-semibold text-ink num">{fmtScore(v)}</span>
                          <span className="text-[12.5px] text-muted">{b.label}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-10">
          <Link href="/#map" className="btn btn-outline">Back to Explore countries<span className="box"><ArrowLeft size={16} /></span></Link>
        </div>
      </nav>
    </article>
  );
}

function References({ refs }: { refs: Reference[] }) {
  return (
    <aside aria-label="References" className="border-t border-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">References</h3>
      {refs.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">No references were listed for this score.</p>
      ) : (
        <ol className="mt-3 grid gap-4">
          {refs.map((r, i) => {
            const url = safeUrl(r.url);
            const date = fmtDate(r.published_date);
            return (
              <li key={i} className="text-[14px] leading-snug">
                {url
                  ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-link underline-offset-4 hover:underline">{r.title || url}<span className="sr-only"> (opens in a new tab)</span></a>
                  : <span className="font-semibold text-ink">{r.title || "Untitled source"}</span>}
                <span className="mt-0.5 block text-muted">{[r.publisher, date].filter(Boolean).join(" · ") || "Publisher not stated"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
