"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bandFor } from "@/lib/bands";
import type { IndexSummary } from "@/lib/types";
import { ScoreDrawer } from "./ScoreDrawer";

export type SummaryCountry = IndexSummary["countries"][number];
type DrawerTarget = { countryId: string; pillarId: string; from?: HTMLElement | null };

/** The workbook's composite option, when meta.show_composite is on. */
export const COMPOSITE = "__composite";

type Ctx = {
  summary: IndexSummary;
  byId: Map<string, SummaryCountry>;
  // ── shared exploration state: map, search, panel and rankings all use these ──
  selectedId: string | null;
  select: (id: string | null) => void;
  measure: string; // COMPOSITE or a pillar_id
  setMeasure: (m: string) => void;
  measureLabel: string;
  bandFilter: Set<number> | null; // null = all bands
  toggleBand: (index: number) => void;
  clearBands: () => void;
  /** value of the active measure for a country */
  valueOf: (c: SummaryCountry) => number | null;
  /** rank (1 = highest, ties share a rank) on the active measure */
  rankOf: (id: string) => number;
  /** true when the country's band on the active measure passes the band filter */
  passesFilter: (c: SummaryCountry) => boolean;
  // ── score drawer ──
  openScore: (countryId: string, pillarId: string, from?: HTMLElement | null) => void;
};
const ExplorerCtx = createContext<Ctx | null>(null);
export const useExplorer = () => {
  const c = useContext(ExplorerCtx);
  if (!c) throw new Error("useExplorer outside ExplorerProvider");
  return c;
};

/** Single source of truth for the landing page's exploration state, plus the score
 *  drawer. The drawer is deep-linkable (?country=<id>&pillar=<id>); the URL is read on
 *  the client after load, not via useSearchParams, so the page stays fully static. */
export function ExplorerProvider({ summary, children }: { summary: IndexSummary; children: React.ReactNode }) {
  const { meta, pillars, countries } = summary;
  const byId = useMemo(() => new Map(countries.map((c) => [c.country_id, c])), [countries]);
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<string>(meta.show_composite ? COMPOSITE : pillars[0]?.pillar_id ?? COMPOSITE);
  const [bandFilter, setBandFilter] = useState<Set<number> | null>(null);

  const valueOf = useCallback(
    (c: SummaryCountry) => (measure === COMPOSITE ? c.composite_score : c.scores[measure] ?? null),
    [measure],
  );
  const ranks = useMemo(() => {
    const sorted = countries.map((c) => ({ id: c.country_id, v: valueOf(c) })).filter((x) => x.v != null).sort((a, b) => b.v! - a.v!);
    const m = new Map<string, number>();
    sorted.forEach((x, i) => m.set(x.id, i > 0 && sorted[i - 1].v === x.v ? m.get(sorted[i - 1].id)! : i + 1));
    return m;
  }, [countries, valueOf]);
  const rankOf = useCallback((id: string) => ranks.get(id) ?? 0, [ranks]);
  const passesFilter = useCallback((c: SummaryCountry) => {
    if (!bandFilter) return true;
    const v = valueOf(c);
    return v != null && bandFilter.has(bandFor(v, meta.score_bands).index);
  }, [bandFilter, valueOf, meta.score_bands]);
  const toggleBand = useCallback((i: number) => setBandFilter((cur) => {
    const next = new Set(cur ?? []);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next.size === 0 || next.size === meta.score_bands.length ? null : next;
  }), [meta.score_bands.length]);
  const measureLabel = measure === COMPOSITE ? "Composite score" : pillars.find((p) => p.pillar_id === measure)?.name ?? "";

  const openScore = useCallback((countryId: string, pillarId: string, from?: HTMLElement | null) => {
    setSelectedId(countryId); // opening a score also selects its country
    setTarget((t) => ({ countryId, pillarId, from: from ?? t?.from ?? null }));
    const url = new URL(window.location.href);
    url.searchParams.set("country", countryId);
    url.searchParams.set("pillar", pillarId);
    window.history.replaceState(null, "", url);
  }, []);

  const close = useCallback(() => {
    setTarget((t) => {
      if (t?.from && document.contains(t.from)) requestAnimationFrame(() => t.from?.focus());
      return null;
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("country");
    url.searchParams.delete("pillar");
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("country"), p = q.get("pillar");
    if (c && p && byId.has(c) && pillars.some((x) => x.pillar_id === p)) {
      // Reading the URL has to wait until after hydration: useSearchParams would push
      // the page out of static rendering (see CLAUDE.md). One-off sync from the URL.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(c);
      setTarget({ countryId: c, pillarId: p });
    }
  }, [byId, pillars]);

  return (
    <ExplorerCtx.Provider value={{
      summary, byId, selectedId, select: setSelectedId, measure, setMeasure, measureLabel,
      bandFilter, toggleBand, clearBands: () => setBandFilter(null), valueOf, rankOf, passesFilter, openScore,
    }}>
      {children}
      <ScoreDrawer target={target} onClose={close} onNavigate={(pillarId) => target && openScore(target.countryId, pillarId)} />
    </ExplorerCtx.Provider>
  );
}
