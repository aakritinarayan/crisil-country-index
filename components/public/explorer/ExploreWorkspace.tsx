"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { allBands, bandFor } from "@/lib/bands";
import { Close, GlobeIcon, MapIcon, PanelRight } from "@/components/ui/icons";
import { CountryCombobox } from "../CountryCombobox";
import { enterExplorer } from "../hero/enter-explorer";
import { CountryPanel } from "./CountryPanel";
import { useExplorer } from "./ExplorerContext";
import { Globe, type GeoViewHandle, type GlobeItem } from "./Globe";
import { PillarSelector } from "./PillarSelector";
import { WorldMap, type MapItem } from "./WorldMap";
import { nCountries } from "@/lib/plural";

const DESKTOP = "(min-width: 1024px)";
/** Hand-off progress at which the globe counts as arrived and becomes interactive. */
const ARRIVED = 0.9;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
type View = "globe" | "flat";

/** Country Explorer: compact heading, one toolbar (search, Globe / Flat map, "Colour map
 *  by"), then a large geographic viewer (~70%) beside the contextual country panel (~30%).
 *  Both views read the same ExplorerContext and stay mounted, so switching keeps the
 *  selection, measure, band filter and each view's own camera; the new view also picks up
 *  the old one's centre and rough zoom. The control group's Expand opens the same toolbar,
 *  viewer and panel as a full-screen workspace (Close or Escape restores the page).
 *
 *  Hero hand-off (lg and up): the globe here is also the hero's half-globe. It stays in the
 *  viewer and is drawn back to the bottom of the hero with a transform: as the page scrolls
 *  from the hero to this section it rises, shrinks and moves into the viewer, and its look
 *  blends from the photographic hero Earth to the light explorer globe (`--photo`). Scroll
 *  only drives that transform and blend, written straight to the DOM; nothing is pinned.
 *  Reduced motion: it jumps between the two states. Below lg the hero has its own
 *  half-globe and this one is simply in the flow. */
export function ExploreWorkspace() {
  const { summary, selectedId, select, valueOf, rankOf, measureLabel, overview, bandFilter, toggleBand, clearBands } = useExplorer();
  const { meta, countries } = summary;
  const bands = allBands(meta.score_bands);
  const [view, setView] = useState<View>("globe");
  const [arrived, setArrived] = useState(true);
  const [heroBlend, setHeroBlend] = useState(1); // 0 hero presentation … 1 explorer camera
  const [desktop, setDesktop] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const slot = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const scrollHint = useRef<HTMLAnchorElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const expandedRef = useRef(false);
  const globeRef = useRef<GeoViewHandle>(null);
  const mapRef = useRef<GeoViewHandle>(null);

  const items: MapItem[] = useMemo(
    () => countries.map((c) => ({ id: c.country_id, iso: c.iso_code, name: c.name, value: valueOf(c), rank: rankOf(c.country_id) })),
    [countries, valueOf, rankOf],
  );
  const globeItems: GlobeItem[] = items;
  const missing = items.filter((i) => i.value == null).length;
  const counts = bands.map((b) => items.filter((i) => i.value != null && bandFor(i.value, meta.score_bands).index === b.index).length);
  const options = useMemo(() => countries.map(({ country_id, name, slug, iso_code, composite_score, rank }) => ({ country_id, name, slug, iso_code, composite_score, rank })), [countries]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0, size = 1, drop = 0;

    // the hero globe: centred, its top just clear of the intro and its centre at (or a
    // little below) the bottom of the first fold, so most of the upper half shows large
    const layout = () => {
      const stage = document.getElementById("hero-stage"), intro = document.getElementById("hero-intro"), fl = flyer.current;
      if (!stage || !intro || !fl) return;
      const cy = stage.offsetHeight;
      const room = cy - (intro.offsetTop + intro.offsetHeight + 40); // intro to fold, with breathing room
      const r = Math.max(200, Math.min(room * 1.34, stage.offsetWidth * 0.48));
      drop = Math.max(0, r - room); // how far below the fold the centre sits
      size = r / (0.47 * Math.min(fl.offsetWidth, fl.offsetHeight)); // Globe's sphere: 47% of the shorter side
    };
    /* One timeline. k (0 → 1) is the page's progress from the top to the explorer; every
     * part of the hand-off is a function of it, written in this one rAF-throttled pass:
     *   0    → .30  hero text fades and drifts up (then becomes inert)
     *   .40  → .66  backdrop blends charcoal → sage (kept short: the midpoint is grey)
     *   0    → .82  globe travels into its viewer and shrinks (CSS transform only)
     *   .36  → .66  photo Earth → light globe;  .35 → .82  hero camera → explorer camera
     *   .80  → .95  explorer heading, toolbar, panel and legend fade in (inert until then)
     * The globe is in place before the explorer UI appears, so it never sits over it.
     * Reduced motion snaps k to 0 or 1. Below lg there is no travel; only the backdrop
     * and the hero text follow k. */
    const apply = () => {
      raf = 0;
      const fl = flyer.current, sl = slot.current, map = document.getElementById("map"), stage = document.getElementById("hero-stage");
      if (!fl || !sl || !map || !stage) return;
      const root = document.documentElement, hint = scrollHint.current, intro = document.getElementById("hero-intro");
      const end = map.getBoundingClientRect().top + window.scrollY - headerHeight();
      let k = end > 0 ? Math.min(1, Math.max(0, window.scrollY / end)) : 1;
      if (reduce.matches) k = k < 0.5 ? 0 : 1;
      const travel = mq.matches && !expandedRef.current;
      const out = smooth(0, 0.3, k), mix = smooth(0.4, 0.66, k), reveal = travel ? smooth(0.8, 0.95, k) : 1;
      root.style.setProperty("--hero-out", out.toFixed(3));
      root.style.setProperty("--bg-mix", mix.toFixed(3));
      root.style.setProperty("--explore-in", reveal.toFixed(3));
      root.classList.add("tx-ready");
      if (intro) intro.inert = out > 0.6;
      // controls stay out of the tab order until they are shown (the heading itself stays
      // focusable: "Explore countries" moves focus there)
      map.querySelectorAll<HTMLElement>(".explore-reveal:not(#explore-head)").forEach((el) => { el.inert = reveal < 0.5; });

      if (!travel) {
        fl.style.transform = ""; fl.style.setProperty("--photo", "0"); setArrived(true); setHeroBlend(1);
        if (hint) hint.style.visibility = "hidden";
        return;
      }
      const e = smooth(0, 0.82, k);
      const st = stage.getBoundingClientRect(), sr = sl.getBoundingClientRect();
      const dx = st.left + st.width / 2 - (sr.left + sr.width / 2);
      const dy = st.bottom + drop - (sr.top + sr.height / 2);
      fl.style.transform = `translate(${dx * (1 - e)}px, ${dy * (1 - e)}px) scale(${size + (1 - size) * e})`;
      fl.style.setProperty("--photo", String(1 - smooth(0.36, 0.66, k)));
      setArrived(k >= ARRIVED);
      // the drawn camera: exactly the hero's early on, the visitor's once in place
      setHeroBlend(Math.round(smooth(0.35, 0.82, k) * 400) / 400);
      // "Scroll to explore the world" sits on the first fold's lower edge and fades out first
      if (hint) {
        const sec = map.getBoundingClientRect();
        hint.style.transform = `translate(${st.left + st.width / 2 - sec.left}px, ${st.bottom - 64 - sec.top}px) translateX(-50%)`;
        hint.style.opacity = String(1 - smooth(0, 0.12, k));
        hint.style.visibility = k > 0.14 ? "hidden" : "visible";
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onResize = () => { setDesktop(mq.matches); layout(); apply(); };

    onResize();
    flyer.current?.setAttribute("data-ready", "");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    mq.addEventListener("change", onResize);
    reduce.addEventListener("change", onResize);
    document.fonts?.ready.then(onResize); // the hero intro's height settles once the font loads
    // re-measure whenever the viewer, the hero stage or the hero text settle at a new size,
    // so the hero globe is always computed from the final layout (never a stale one)
    const ro = new ResizeObserver(onResize);
    for (const el of [slot.current, document.getElementById("hero-stage"), document.getElementById("hero-intro")]) if (el) ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onResize);
      reduce.removeEventListener("change", onResize);
      // leaving the homepage: drop the hand-off state so other pages render normally
      const root = document.documentElement;
      root.classList.remove("tx-ready");
      for (const v of ["--hero-out", "--bg-mix", "--explore-in"]) root.style.removeProperty(v);
    };
  }, []);

  // expanded workspace: page scroll locked, focus moved in and kept in, Escape closes
  useEffect(() => {
    expandedRef.current = expanded;
    if (!expanded) return;
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.preventDefault(); setExpanded(false); return; }
      if (e.key !== "Tab" || !shell.current) return;
      const f = [...shell.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
      requestAnimationFrame(() => (returnFocus.current?.isConnected ? returnFocus.current : document.getElementById("explore-h"))?.focus());
    };
  }, [expanded]);
  const toggleExpanded = () => {
    if (!expanded) returnFocus.current = document.activeElement as HTMLElement | null;
    setExpanded((x) => !x);
  };

  // switching views hands the geographic focus across; a selection keeps its own framing
  const switchView = (v: View) => {
    if (v === view) return;
    const from = (v === "flat" ? globeRef : mapRef).current?.getFocus();
    setView(v);
    if (from) (v === "flat" ? mapRef : globeRef).current?.setFocus(from);
  };

  const flat = view === "flat";
  const geoProps = { bands: meta.score_bands, neutral: overview, activeBands: overview ? null : bandFilter, selectedId, onSelect: select, expanded, onExpand: toggleExpanded };

  return (
    <section id="map" aria-labelledby="explore-h" className="explore" data-view={view}>
      <a ref={scrollHint} href="#map" onClick={(e) => { e.preventDefault(); enterExplorer(); }}
        className="hero-scroll absolute left-0 top-0 z-[3] hidden lg:inline-flex" style={{ visibility: "hidden" }}>
        <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v15M6 13l6 6 6-6" /></svg><span className="sr-only">Scroll to explore the world</span>
      </a>
      <div className="wrap relative pt-8 lg:pt-6">
      <div id="explore-head" className="explore-reveal relative z-[2]">
        <p className="eyebrow">Explore the index</p>
        <h2 id="explore-h" tabIndex={-1} className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-ink outline-none sm:text-[30px]">
          {nCountries(countries.length)}, <span className="grad-text">one map</span>
        </h2>
      </div>

      <div ref={shell} className={`explorer-shell ${expanded ? "is-expanded" : ""}`}
        role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? "Expanded map" : undefined}>
        {/* one toolbar: search | map view | assessment tabs (only the tabs may scroll) */}
        <div className="explorer-toolbar explore-reveal relative z-[2]">
          <CountryCombobox countries={options} bands={meta.score_bands} size="toolbar" showCount={false} placeholder="Search a country"
            onSelect={(c) => select(c.country_id)} className="explore-search order-1 min-w-0 flex-1 lg:w-[280px] lg:flex-none" />
          <div role="radiogroup" aria-label="Map view" className="view-toggle order-2">
            {(["globe", "flat"] as const).map((v) => {
              const name = v === "globe" ? "Globe" : "Flat map";
              return (
                <label key={v} className="relative cursor-pointer" data-tip={name}>
                  <input type="radio" name="view" value={v} checked={view === v} onChange={() => switchView(v)} aria-label={name} className="peer sr-only" />
                  <span aria-hidden className="view-toggle-btn">{v === "globe" ? <GlobeIcon size={19} /> : <MapIcon size={19} />}</span>
                </label>
              );
            })}
          </div>
          <div className="order-4 min-w-0 basis-full lg:order-3 lg:basis-0 lg:flex-1"><PillarSelector /></div>
          {expanded && (
            <div className="order-3 ml-auto flex shrink-0 items-center gap-1 lg:order-4">
              <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="explorer-panel"
                className="inline-flex h-12 items-center gap-2 px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken hover:text-ink">
                <PanelRight size={16} /><span className="hidden sm:inline">{panelOpen ? "Hide details" : "Show details"}</span>
              </button>
              <button ref={closeBtn} type="button" onClick={() => setExpanded(false)} aria-label="Close expanded map"
                className="grid size-12 place-items-center border border-line text-ink hover:bg-sunken"><Close size={17} /></button>
            </div>
          )}
        </div>

        <div className={`explorer-body ${panelOpen ? "" : "panel-closed"}`}>
          <div className="min-w-0">
            <div ref={slot} data-view={view} data-arrived={arrived || undefined} className="explorer-viewer">
              <div ref={flyer} data-arrived={arrived || undefined} className="globe-fly">
                <Globe ref={globeRef} items={globeItems} {...geoProps} mode={arrived ? "explore" : "intro"}
                  onActivate={enterExplorer} label="Explore countries on the globe" photo={desktop && !expanded} controls heroBlend={heroBlend} />
              </div>
              <div className="flat-layer" inert={!flat}>
                <WorldMap ref={mapRef} items={items} {...geoProps} metricLabel={measureLabel} />
              </div>

              {/* legend, inside the viewer's lower edge. In score modes each band is also a filter toggle. */}
              <div className="map-legend explore-reveal">
                {overview ? (
                  <ul aria-label="Map legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2">
                    <li className="flex items-center gap-2"><span aria-hidden className="size-2.5 ring-1 ring-[var(--globe-coast)] bg-[var(--globe-land)]" />Assessed <span className="font-semibold text-ink num">{countries.length}</span></li>
                    <li className="flex items-center gap-2"><span aria-hidden className="size-2.5 ring-1 ring-[var(--globe-border)] bg-[var(--globe-land-2)]" />Not assessed</li>
                  </ul>
                ) : (
                  <fieldset className="min-w-0">
                    <legend className="sr-only">Filter by score band ({measureLabel}), lower to higher readiness</legend>
                    {/* one sequential scale: adjoining steps, low → high; each step is also a filter */}
                    <div className="flex items-stretch gap-px">
                      {bands.map((b, i) => {
                        const pressed = !!bandFilter?.has(i);
                        const on = !bandFilter || pressed;
                        return (
                          <button key={b.label} type="button" aria-pressed={pressed} onClick={() => toggleBand(i)}
                            aria-label={`${b.label}, ${b.min}–${b.max}: ${counts[i]} ${counts[i] === 1 ? "country" : "countries"}`}
                            className={`group flex min-w-[64px] flex-col items-start gap-1 px-1.5 pb-1 pt-1 text-left transition-[opacity,background-color] hover:bg-sunken ${pressed ? "bg-sunken" : ""} ${on ? "" : "opacity-40"}`}>
                            <span aria-hidden className="block h-2 w-full" style={{ background: b.fill, boxShadow: "inset 0 0 0 .5px rgb(0 0 0 / .12)" }} />
                            <span className={`text-[12px] leading-none ${pressed ? "font-semibold text-ink" : "text-ink-2"}`}>{b.label}</span>
                            <span className="text-[11px] leading-none text-muted num">{b.min}–{b.max}</span>
                          </button>
                        );
                      })}
                      <span className="ml-3 flex flex-col items-start gap-1 px-1.5 pt-1 text-muted">
                        <span aria-hidden className="unassessed-swatch block h-2 w-12" />
                        <span className="text-[12px] leading-none">Not assessed</span>
                      </span>
                      {missing > 0 && (
                        <span className="flex flex-col items-start gap-1 px-1.5 pt-1 text-muted">
                          <span aria-hidden className="block h-2 w-10 bg-[var(--globe-land)] ring-1 ring-inset ring-[var(--globe-coast)]" />
                          <span className="text-[12px] leading-none">No score</span><span className="text-[11px] leading-none num">{missing}</span>
                        </span>
                      )}
                    </div>
                    <div aria-hidden className="mt-1 flex justify-between px-1.5 text-[10.5px] text-muted"><span>Lower</span><span>Higher readiness →</span></div>
                    {bandFilter && <button type="button" onClick={clearBands} className="mt-1 px-1.5 text-[12px] font-semibold text-link underline underline-offset-4">Show all bands</button>}
                  </fieldset>
                )}
              </div>
            </div>
            {!expanded && (
              <a href="#rankings" className="explore-reveal mt-3 inline-block text-[12.5px] font-semibold text-link underline decoration-1 underline-offset-4">Browse all countries as a list</a>
            )}
          </div>

          <aside id="explorer-panel" aria-label="Country assessment" className="explorer-panel explore-reveal relative z-[2] min-w-0">
            <CountryPanel view={view} />
          </aside>
        </div>
      </div>
      </div>
    </section>
  );
}

const headerHeight = () => (document.querySelector("header") as HTMLElement | null)?.offsetHeight ?? 64;
