"use client";
import Link from "next/link";
import { bandFor, fmtScore } from "@/lib/bands";
import { ArrowRight, Close } from "@/components/ui/icons";
import { CountryShape } from "./CountryShape";
import { useExplorer } from "./ExplorerContext";

/** Contextual country assessment beside the geographic viewer. Nothing is pre-selected:
 *  until then it is a single invitation. With a selection it reads like a short profile —
 *  name, the country's shape, composite and band, every pillar as a scored bar (each opens
 *  the rationale drawer), and the way to the full profile. No cards, hairlines only. */
export function CountryPanel({ view }: { view: "globe" | "flat" }) {
  const { summary, byId, selectedId, select, rankOf, overview, measure, measureLabel, openScore } = useExplorer();
  const { meta, pillars, countries } = summary;
  const c = selectedId ? byId.get(selectedId) : undefined;

  if (!c) {
    return (
      <div className="lg:pt-6">
        <p className="label text-muted">Country assessment</p>
        <h3 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Choose a country</h3>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-muted">Its score, performance band and every pillar will appear here.</p>
        {/* three ways in, kept short */}
        <ol className="mt-7 grid gap-3 border-t border-line pt-5 text-[14px] text-ink-2">
          {[
            `Select a country on the ${view === "globe" ? "globe" : "map"}`,
            "Or search by name or ISO code",
            "Colour the map by a pillar to compare",
          ].map((t, i) => (
            <li key={t} className="flex items-baseline gap-3">
              <span className="w-4 shrink-0 text-[12px] font-semibold text-[var(--teal)] num">{i + 1}</span>{t}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const composite = meta.show_composite && c.composite_score != null ? bandFor(c.composite_score, meta.score_bands) : null;
  return (
    <div aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label text-muted num">
            {c.iso_code}<span className="mx-2 text-line-strong">/</span>#{rankOf(c.country_id)} of {countries.length} · {measureLabel}
          </p>
          <h3 className="mt-2 text-[36px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">{c.name}</h3>
        </div>
        <button type="button" onClick={() => select(null)} className="grid size-9 shrink-0 place-items-center text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label={`Clear selection: ${c.name}`}><Close size={16} /></button>
      </div>

      {/* square preview tile: the country as it is selected on the globe */}
      <div className="mt-4 aspect-square w-full max-w-[260px] overflow-hidden rounded-[6px] ring-1 ring-inset ring-line">
        <CountryShape key={c.iso_code} iso={c.iso_code} name={c.name} fill="var(--sel-fill)" />
      </div>

      {composite && (
        <div className="mt-5 flex items-center gap-5 border-y border-line py-5">
          <span className="text-[56px] font-semibold leading-[.9] tracking-[-0.04em] text-ink num">{fmtScore(c.composite_score!)}</span>
          <span className="leading-tight">
            <span className="block label text-muted">Composite</span>
            <span className="mt-1.5 inline-flex items-center gap-2 text-[17px] font-semibold text-ink">
              <span aria-hidden className="size-2.5 ring-1 ring-black/10" style={{ background: composite.fill }} />{composite.label}
            </span>
          </span>
        </div>
      )}

      <h4 className="mt-6 label text-muted">Pillars</h4>
      <ul className="mt-2 grid gap-1">
        {pillars.map((p) => {
          const v = c.scores[p.pillar_id];
          const b = bandFor(v, meta.score_bands);
          const active = !overview && measure === p.pillar_id;
          return (
            <li key={p.pillar_id}>
              {/* the whole row opens the rationale drawer */}
              <button type="button" onClick={(e) => openScore(c.country_id, p.pillar_id, e.currentTarget)}
                aria-label={`${p.name}: ${fmtScore(v)}, ${b.label}. Open rationale and sources`}
                className="group -mx-2 grid w-[calc(100%+16px)] grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 px-2 py-2.5 text-left transition-colors hover:bg-sunken">
                <span className={`truncate text-[14px] ${active ? "font-semibold text-ink" : "text-ink-2 group-hover:text-ink"}`}>{p.name}</span>
                <span className="text-[14px] font-semibold text-ink num">{fmtScore(v)}<span className="ml-1.5 text-[12px] font-normal text-muted">{b.label}</span></span>
                <span className="col-span-2 h-[3px] bg-[var(--line)]" aria-hidden>
                  <span className="block h-full transition-[width] duration-500" style={{ width: `${((v - meta.score_min) / (meta.score_max - meta.score_min)) * 100}%`, background: b.fill, boxShadow: "inset 0 0 0 .5px rgb(0 0 0 / .18)" }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-muted">Select a pillar for its rationale and sources.</p>
      <Link href={`/country/${c.slug}`} className="btn mt-7 w-full justify-between">View country profile<span className="box"><ArrowRight size={16} /></span></Link>
    </div>
  );
}
