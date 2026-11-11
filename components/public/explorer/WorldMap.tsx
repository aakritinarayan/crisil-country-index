"use client";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { geoArea, geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import smallStates from "@/data/small-states.json";
import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";
import { ISO_TO_NUM, SMALL_AREA, loadTopo } from "../geo";
import type { GeoViewHandle } from "./Globe";
import { MapControls, WheelHint, tween, useWheelZoom } from "./MapControls";

export type MapItem = { id: string; iso: string; name: string; value: number | null; rank: number };

const MAX_K = 12, PAD = 16;
const SMALL = smallStates as unknown as Record<string, [number, number]>;
type Shape = { key: string; num: string; d: string; b: [[number, number], [number, number]] };
type View = { k: number; x: number; y: number };
const IDENTITY: View = { k: 1, x: 0, y: 0 };

/** Flat world map (Equal Earth), the Country Explorer's second view, filling its container
 *  at its true aspect (the sea fills the rest). Same family as the globe: world-atlas 50m,
 *  a pale misty sea, borders and coastlines as separate fine meshes, the same selection
 *  and hover treatment, ringed markers for countries too small to click.
 *
 *  Navigation: drag to pan; wheel, trackpad pinch, touch pinch and double-click zoom
 *  around the pointer (1×–12×); arrow keys pan and +/− zoom; the control group zooms,
 *  fits the selected country, resets and expands. Panning stops at the map's edges.
 *  A selection is fitted with padding (small states get a minimum size); the visitor's own
 *  pan and zoom are kept until the selection changes. */
export function WorldMap({ ref, items, bands, activeBands, selectedId, onSelect, metricLabel, neutral, expanded = false, onExpand }: {
  ref?: React.Ref<GeoViewHandle>;
  items: MapItem[]; bands: ScoreBand[]; activeBands: Set<number> | null; selectedId: string | null;
  onSelect: (id: string) => void; metricLabel: string; neutral: boolean;
  expanded?: boolean; onExpand?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, []);
  const { w: W, h: H } = size;

  const [topo, setTopo] = useState<Topology | null>(null);
  useEffect(() => { loadTopo("50m").then(setTopo); }, []);
  // The visitor's own zoom/pan, remembered for the selection it was made under.
  // Changing the selection hands control back to the selection's own view.
  const [manual, setManual] = useState<{ for: string | null; view: View } | null>(null);
  const [smoothMove, setSmoothMove] = useState(true); // CSS-eased moves for clicks; none for wheel/drag
  const [hover, setHover] = useState<{ item: MapItem; x: number; y: number; flip: boolean } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: "pan"; x: number; y: number; v: View; moved: boolean } | { kind: "pinch"; dist: number; v: View; mx: number; my: number } | null>(null);
  const moved = useRef(false);

  const byNum = useMemo(() => {
    const m = new Map<string, MapItem>();
    for (const it of items) { const n = ISO_TO_NUM[it.iso]; if (n) m.set(n, it); }
    return m;
  }, [items]);

  const geo = useMemo(() => {
    if (!topo || !W || !H) return null;
    const obj = topo.objects.countries as GeometryCollection;
    const kept = { ...obj, geometries: obj.geometries.filter((g) => g.id !== "010") }; // drop Antarctica
    const features = (feature(topo, kept) as unknown as { features: Feature<Geometry>[] }).features;
    const proj = geoEqualEarth().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: "FeatureCollection", features } as GeoPermissibleObjects);
    const path = geoPath(proj).digits(2);
    const shapes: Shape[] = [];
    const small = new Set<string>();
    for (const [i, f] of features.entries()) {
      const d = path(f);
      if (!d) continue;
      shapes.push({ key: `${f.id ?? "x"}-${i}`, num: String(f.id), d, b: path.bounds(f) });
      if (geoArea(f) < SMALL_AREA) small.add(String(f.id));
    }
    return {
      proj, shapes, small, extent: path.bounds({ type: "Sphere" }),
      borders: path(mesh(topo, kept, (a, b) => a !== b)) ?? "",
      coast: path(mesh(topo, kept, (a, b) => a === b)) ?? "",
    };
  }, [topo, W, H]);

  /** Keep the map in view: no panning past its edges; centred on an axis it doesn't fill. */
  const clampView = useCallback((v: View): View => {
    const k = Math.min(MAX_K, Math.max(1, v.k));
    if (!geo) return { k, x: v.x, y: v.y };
    const [[x0, y0], [x1, y1]] = geo.extent;
    const axis = (pos: number, a0: number, a1: number, span: number) => {
      const lo = span - PAD - a1 * k, hi = PAD - a0 * k;
      return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, pos));
    };
    return { k, x: axis(v.x, x0, x1, W), y: axis(v.y, y0, y1, H) };
  }, [geo, W, H]);

  // countries with no shape at this scale, or too small to click, get a marker
  const dots = useMemo(() => {
    if (!geo) return [];
    const drawn = new Map(geo.shapes.map((s) => [s.num, s]));
    return items.flatMap((it) => {
      const num = ISO_TO_NUM[it.iso];
      const s = num ? drawn.get(num) : undefined;
      if (s && !geo.small.has(num)) return [];
      const p = s ? [(s.b[0][0] + s.b[1][0]) / 2, (s.b[0][1] + s.b[1][1]) / 2] : SMALL[it.iso] ? geo.proj(SMALL[it.iso]) : null;
      const area = s ? (s.b[1][0] - s.b[0][0]) * (s.b[1][1] - s.b[0][1]) : 0; // projected size at zoom 1
      return p ? [{ item: it, x: p[0], y: p[1], area }] : [];
    });
  }, [items, geo]);

  const colour = (it: MapItem | undefined) => {
    if (!it) return { fill: neutral ? "var(--globe-land-2)" : "url(#fm-unassessed)", dim: false };
    if (neutral || it.value == null) return { fill: "var(--globe-land)", dim: false }; // missing score stays neutral
    const b = bandFor(it.value, bands);
    return { fill: b.fill, dim: !!activeBands && !activeBands.has(b.index) };
  };

  /** The view that fits a country with padding; small states get a minimum box. */
  const fitView = useCallback((cid: string | null): View => {
    if (!cid || !geo) return clampView(IDENTITY);
    const it = items.find((i) => i.id === cid);
    if (!it) return clampView(IDENTITY);
    const s = geo.shapes.find((x) => x.num === ISO_TO_NUM[it.iso]);
    const d = dots.find((x) => x.item.id === cid);
    let [[x0, y0], [x1, y1]] = s ? s.b : d ? [[d.x, d.y], [d.x, d.y]] : [[0, 0], [W, H]];
    const min = Math.min(W, H) * 0.06; // practical minimum so small states keep context
    if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
    if (y1 - y0 < min) { const c = (y0 + y1) / 2; y0 = c - min / 2; y1 = c + min / 2; }
    const k = Math.max(1.4, Math.min(MAX_K, 0.55 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    return clampView({ k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k });
  }, [geo, items, dots, W, H, clampView]);

  const view = manual && manual.for === selectedId ? manual.view : fitView(selectedId);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; });
  const setView = (v: View, eased = false) => { setSmoothMove(eased); setManual({ for: selectedId, view: clampView(v) }); };
  const zoomAt = (f: number, x: number, y: number, eased = false) => {
    const v = viewRef.current;
    const k = Math.min(MAX_K, Math.max(1, v.k * f));
    setView({ k, x: x - ((x - v.x) * k) / v.k, y: y - ((y - v.y) * k) / v.k }, eased);
  };

  useImperativeHandle(ref, () => ({
    getFocus: () => {
      if (!geo) return null;
      const v = viewRef.current;
      const ll = geo.proj.invert!([(W / 2 - v.x) / v.k, (H / 2 - v.y) / v.k]);
      return ll ? { ll: ll as [number, number], zoom: Math.max(1, v.k * 0.8) } : null;
    },
    setFocus: (f) => {
      if (!geo || selectedId) return; // a selection keeps its own view
      const p = geo.proj(f.ll);
      if (!p) return;
      const k = Math.max(1, f.zoom / 0.8);
      setSmoothMove(false);
      setManual({ for: selectedId, view: clampView({ k, x: W / 2 - p[0] * k, y: H / 2 - p[1] * k }) });
    },
  }));

  const hint = useWheelZoom(box, expanded, (f, x, y) => zoomAt(f, x, y));

  const local = (e: { clientX: number; clientY: number }) => { const r = box.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const tip = (e: React.PointerEvent, it: MapItem) => {
    if (moved.current || e.pointerType !== "mouse") return;
    const p = local(e);
    setHover({ item: it, ...p, flip: p.x > W - 200 });
  };
  const pick = (cid: string) => { if (!moved.current) onSelect(cid); };

  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    if (pointers.current.size === 1) gesture.current = { kind: "pan", ...local(e), v: viewRef.current, moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), v: viewRef.current, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      moved.current = true;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const k = Math.min(MAX_K, Math.max(1, (g.v.k * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist));
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // zoom about the starting midpoint, then follow the midpoint (two-finger pan)
      setView({ k, x: mx - ((g.mx - g.v.x) * k) / g.v.k, y: my - ((g.my - g.v.y) * k) / g.v.k });
      return;
    }
    if (g.kind !== "pan") return;
    const p = local(e);
    const dx = p.x - g.x, dy = p.y - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 4) {
      g.moved = moved.current = true;
      setGrabbing(true); setHover(null);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (g.moved) setView({ k: g.v.k, x: g.v.x + dx, y: g.v.y + dy });
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) { gesture.current = null; setGrabbing(false); setTimeout(() => { moved.current = false; }, 0); }
    else if (pointers.current.size === 1) { const [p] = [...pointers.current.values()]; gesture.current = { kind: "pan", ...p, v: viewRef.current, moved: true }; }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const v = viewRef.current, step = 60;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => setView({ ...v, x: v.x + step }, true), ArrowRight: () => setView({ ...v, x: v.x - step }, true),
      ArrowUp: () => setView({ ...v, y: v.y + step }, true), ArrowDown: () => setView({ ...v, y: v.y - step }, true),
      "+": () => zoomAt(1.5, W / 2, H / 2, true), "=": () => zoomAt(1.5, W / 2, H / 2, true), "-": () => zoomAt(1 / 1.5, W / 2, H / 2, true),
      "0": () => setView(IDENTITY, true),
    };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  };

  // eased camera for the control buttons (CSS transition is off during gestures)
  const stopTween = useRef<() => void>(() => {});
  const glide = (to: View) => {
    stopTween.current();
    const from = viewRef.current, target = clampView(to);
    setSmoothMove(false);
    stopTween.current = tween(450, (e) => {
      const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
      setManual({ for: selectedId, view: { k, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e } });
    });
  };
  useEffect(() => () => stopTween.current(), []);
  const zoomCentre = (f: number) => {
    const v = viewRef.current, k = Math.min(MAX_K, Math.max(1, v.k * f));
    glide({ k, x: W / 2 - ((W / 2 - v.x) * k) / v.k, y: H / 2 - ((H / 2 - v.y) * k) / v.k });
  };

  const selected = items.find((i) => i.id === selectedId);
  const sel = selected && geo ? geo.shapes.find((s) => s.num === ISO_TO_NUM[selected.iso]) : undefined;
  const hov = hover && hover.item.id !== selectedId && geo ? geo.shapes.find((s) => s.num === ISO_TO_NUM[hover.item.iso]) : undefined;
  const identity = clampView(IDENTITY);

  return (
    <div ref={box} className={`geo-surface absolute inset-0 select-none overflow-hidden ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: expanded ? "none" : "pan-y" }} tabIndex={0} onKeyDown={onKey}
      aria-label="World map. Drag or use the arrow keys to move, plus and minus to zoom.">
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="flat-map block"
          role="img" aria-label={`${neutral ? `World map of the ${items.length} assessed countries` : `World map coloured by ${metricLabel}`}. For keyboard and screen-reader access to countries, use the search or the rankings list.`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={(e) => { const p = local(e); zoomAt(2, p.x, p.y, true); }}>
          <defs>
            <pattern id="fm-unassessed" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" style={{ fill: "var(--unassessed)" }} />
              <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: "var(--unassessed-hatch)" }} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="var(--map-sea)" />
          {geo && (
            <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transition: smoothMove && !grabbing ? "transform .6s var(--ease-out-expo)" : "none" }}>
              {geo.shapes.map((s) => {
                const it = byNum.get(s.num);
                const c = colour(it);
                return (
                  <path key={s.key} d={s.d} data-country={it?.id} fill={c.fill} opacity={c.dim ? 0.18 : 1}
                    className={it ? "cursor-pointer" : ""}
                    onPointerMove={it ? (e) => tip(e, it) : undefined}
                    onClick={it ? () => pick(it.id) : undefined} />
                );
              })}
              <g fill="none" pointerEvents="none" strokeLinejoin="round">
                <path d={geo.borders} stroke="var(--globe-border)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
                <path d={geo.coast} stroke="var(--globe-coast)" strokeWidth={0.85} vectorEffect="non-scaling-stroke" />
              </g>
              {hov && <path d={hov.d} fill={neutral ? "var(--hover-fill)" : "none"} fillOpacity={0.55} stroke="var(--hover-stroke)" strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="gl-hover" pointerEvents="none" />}
              {/* selected: one fill (teal in Overview, band colour in score modes) and one crisp boundary at every zoom */}
              {sel && <>
                <filter id="fm-sel-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  {/* map units are scaled by the zoom, so divide: the shadow stays 1px / 3px / 5px on screen */}
                  <feDropShadow dx={0} dy={2 / view.k} stdDeviation={3.5 / view.k} style={{ floodColor: "var(--sel-shadow)", floodOpacity: "var(--sel-shadow-a)" }} />
                </filter>
                <path key={sel.num} d={sel.d} fill={neutral ? "var(--sel-fill)" : colour(selected).fill} stroke="var(--sel-outer)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter={geo.small.has(sel.num) ? undefined : "url(#fm-sel-shadow)"} className="gl-selected" pointerEvents="none" />
              </>}
              {dots.map(({ item, x, y, area }) => {
                if (area * view.k * view.k > 260) return null; // big enough to click itself now
                const c = colour(item);
                const on = item.id === selectedId;
                const hot = on || hover?.item.id === item.id;
                const rr = (hot ? 5.4 : 4.5) / view.k;
                return (
                  <g key={item.id} className="gl-marker cursor-pointer" opacity={c.dim ? 0.2 : 1}
                    onPointerMove={(e) => tip(e, item)} onClick={() => pick(item.id)}>
                    {/* 24px hit area; a 9px deep-teal dot (band colour in score modes), thin white edge */}
                    <circle cx={x} cy={y} r={12 / view.k} fill="transparent" />
                    <circle cx={x} cy={y} r={rr} fill={neutral ? "var(--marker)" : c.fill}
                      stroke={on ? "var(--sel-outer)" : hover?.item.id === item.id ? "var(--hover-stroke)" : neutral ? "var(--marker-edge)" : "var(--marker-score-edge)"}
                      strokeWidth={on ? 1.75 : 1} vectorEffect="non-scaling-stroke" className={on ? "marker-lift" : undefined} />
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      )}

      {!topo && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</div>}

      {hover && (
        <div className="pointer-events-none absolute z-10 border border-line bg-raised/95 px-3 py-2 shadow-soft backdrop-blur-sm"
          style={{ left: hover.x, top: hover.y, transform: `translate(${hover.flip ? "calc(-100% - 14px)" : "14px"}, -50%)` }}>
          <p className="whitespace-nowrap text-[13px] font-semibold text-ink">{hover.item.name}</p>
          {!neutral && (
            <p className="mt-0.5 whitespace-nowrap text-xs text-muted">
              {hover.item.value != null
                ? (() => { const b = bandFor(hover.item.value, bands); return <><span className="font-semibold text-ink num">{fmtScore(hover.item.value)}</span> · {b.label}</>; })()
                : "No score"}
            </p>
          )}
        </div>
      )}

      <WheelHint show={hint} />
      <div className="absolute right-3 top-3 z-20">
        <MapControls
          onZoomIn={() => zoomCentre(1.6)} onZoomOut={() => zoomCentre(1 / 1.6)} canZoomIn={view.k < MAX_K - 0.01} canZoomOut={view.k > 1.01}
          onFit={() => glide(fitView(selectedId))} canFit={!!selected}
          onReset={() => glide(IDENTITY)} canReset={Math.abs(view.k - 1) > 0.01 || Math.abs(view.x - identity.x) > 1 || Math.abs(view.y - identity.y) > 1} resetLabel="Reset view"
          expanded={expanded} onExpand={() => onExpand?.()} />
      </div>
    </div>
  );
}
