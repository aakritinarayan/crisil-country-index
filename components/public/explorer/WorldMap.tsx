"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import isoTable from "@/data/iso-alpha3-to-numeric.json";
import smallStates from "@/data/small-states.json";
import { bandFor, fmtScore } from "@/lib/bands";
import type { ScoreBand } from "@/lib/types";
import { Minus, Plus, Reset } from "@/components/ui/icons";

export type MapItem = { id: string; iso: string; name: string; value: number | null; rank: number };

const W = 960, H = 480, MAX_K = 8;
const ISO_TO_NUM = isoTable as Record<string, string>;
const SMALL = smallStates as unknown as Record<string, [number, number]>;
type Shape = { num: string; d: string; b: [[number, number], [number, number]] };
type View = { k: number; x: number; y: number };
const IDENTITY: View = { k: 1, x: 0, y: 0 };
const clampView = (v: View): View => {
  const k = Math.min(MAX_K, Math.max(1, v.k));
  // keep the map covering the frame: no panning off into empty space
  return { k, x: Math.min(0, Math.max(W - W * k, v.x)), y: Math.min(0, Math.max(H - H * k, v.y)) };
};

let topoPromise: Promise<Topology> | null = null;
const loadTopo = () => (topoPromise ??= import("world-atlas/countries-110m.json").then((m) => (m.default ?? m) as unknown as Topology));

export function WorldMap({ items, bands, activeBands, selectedId, onSelect, metricLabel }: {
  items: MapItem[]; bands: ScoreBand[]; activeBands: Set<number> | null; selectedId: string | null;
  onSelect: (id: string) => void; metricLabel: string;
}) {
  const [topo, setTopo] = useState<Topology | null>(null);
  // The visitor's own zoom/pan, remembered for the selection it was made under.
  // Changing the selection hands control back to the selection's own view.
  const [manual, setManual] = useState<{ for: string | null; view: View } | null>(null);
  const [hover, setHover] = useState<{ item: MapItem; x: number; y: number; flip: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; v: View; moved: boolean } | null>(null);

  useEffect(() => { loadTopo().then(setTopo); }, []);

  const byNum = useMemo(() => {
    const m = new Map<string, MapItem>();
    for (const it of items) { const n = ISO_TO_NUM[it.iso]; if (n) m.set(n, it); }
    return m;
  }, [items]);

  const { shapes, projection } = useMemo(() => {
    if (!topo) return { shapes: [] as Shape[], projection: null };
    const fc = feature(topo, topo.objects.countries as GeometryCollection);
    const features = (fc as unknown as { features: Feature<Geometry>[] }).features.filter((f) => f.id && f.id !== "010"); // drop Antarctica
    const proj = geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features } as GeoPermissibleObjects);
    const path = geoPath(proj);
    const seen = new Set<string>();
    const out: Shape[] = [];
    for (const f of features) {
      const num = String(f.id);
      const d = path(f);
      if (!d) continue;
      out.push({ num, d, b: path.bounds(f) });
      seen.add(num);
    }
    return { shapes: out, projection: proj };
  }, [topo]);

  // countries with no shape at this scale are drawn as dots
  const dots = useMemo(() => {
    if (!projection) return [];
    const drawn = new Set(shapes.map((s) => s.num));
    return items.flatMap((it) => {
      const num = ISO_TO_NUM[it.iso];
      const ll = SMALL[it.iso];
      if ((num && drawn.has(num)) || !ll) return [];
      const p = projection(ll);
      return p ? [{ item: it, x: p[0], y: p[1] }] : [];
    });
  }, [items, shapes, projection]);

  const colour = (it: MapItem | undefined) => {
    if (!it || it.value == null) return { fill: "var(--map-empty)", dim: false };
    const b = bandFor(it.value, bands);
    return { fill: b.fill, dim: !!activeBands && !activeBands.has(b.index) };
  };

  // the view a selection calls for: zoomed to its country (motion is user-initiated)
  const selectionView = useMemo<View>(() => {
    if (!selectedId || !projection) return IDENTITY;
    const it = items.find((i) => i.id === selectedId);
    if (!it) return IDENTITY;
    const s = shapes.find((x) => x.num === ISO_TO_NUM[it.iso]);
    let cx: number, cy: number, k: number;
    if (s) {
      const [[x0, y0], [x1, y1]] = s.b;
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      k = Math.min(5, 0.45 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    } else {
      const d = dots.find((x) => x.item.id === selectedId);
      if (!d) return IDENTITY;
      cx = d.x; cy = d.y; k = 5;
    }
    k = Math.max(1.6, k);
    return clampView({ k, x: W / 2 - cx * k, y: H / 2 - cy * k });
  }, [selectedId, projection, shapes, dots, items]);
  const view = manual && manual.for === selectedId ? manual.view : selectionView;
  const setView = (next: View | ((v: View) => View)) =>
    setManual({ for: selectedId, view: typeof next === "function" ? next(view) : next });

  const zoomBy = (f: number) => setView((v) => {
    const k = Math.min(MAX_K, Math.max(1, v.k * f));
    const cx = (W / 2 - v.x) / v.k, cy = (H / 2 - v.y) / v.k;
    return clampView({ k, x: W / 2 - cx * k, y: H / 2 - cy * k });
  });

  const tip = (e: React.PointerEvent, it: MapItem) => {
    const r = box.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    setHover({ item: it, x, y: e.clientY - r.top, flip: x > r.width - 200 });
  };
  const selected = items.find((i) => i.id === selectedId);
  const sel = selected ? shapes.find((s) => s.num === ISO_TO_NUM[selected.iso]) : undefined;

  return (
    <div ref={box} className="relative select-none overflow-hidden" style={{ touchAction: view.k > 1 ? "none" : "pan-y" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${view.k > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        role="img" aria-label={`World map coloured by ${metricLabel}. For keyboard and screen-reader access, use Find a country or the rankings table below.`}
        onPointerDown={(e) => { drag.current = { px: e.clientX, py: e.clientY, v: view, moved: false }; }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (!g || view.k <= 1) return;
          const r = box.current!.getBoundingClientRect(), s = W / r.width;
          const dx = (e.clientX - g.px) * s, dy = (e.clientY - g.py) * s;
          if (!g.moved && Math.hypot(dx, dy) > 4) { g.moved = true; setDragging(true); (e.currentTarget as Element).setPointerCapture(e.pointerId); }
          if (g.moved) { setHover(null); setView(clampView({ k: g.v.k, x: g.v.x + dx, y: g.v.y + dy })); }
        }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); setDragging(false); }}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={() => zoomBy(2)}>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transition: dragging ? "none" : "transform 0.6s var(--ease-out-expo)" }}>
          {shapes.map((s) => {
            const it = byNum.get(s.num);
            const c = colour(it);
            return (
              <path key={s.num} d={s.d} fill={c.fill} opacity={c.dim ? 0.18 : 1}
                stroke="var(--map-stroke)" strokeWidth={0.6} vectorEffect="non-scaling-stroke"
                className={it ? "cursor-pointer transition-opacity hover:brightness-[1.08]" : ""}
                onPointerMove={it ? (e) => !drag.current?.moved && tip(e, it) : undefined}
                onPointerLeave={() => setHover(null)}
                onClick={it ? () => { if (!drag.current?.moved) onSelect(it.id); } : undefined} />
            );
          })}
          {sel && <path d={sel.d} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {dots.map(({ item, x, y }) => {
            const c = colour(item);
            const on = item.id === selectedId;
            return (
              <circle key={item.id} cx={x} cy={y} r={(on ? 5 : 3.6) / Math.sqrt(view.k)} fill={c.fill} opacity={c.dim ? 0.2 : 1}
                stroke={on ? "var(--ink)" : "var(--map-stroke)"} strokeWidth={on ? 2 : 1} vectorEffect="non-scaling-stroke" className="cursor-pointer"
                onPointerMove={(e) => !drag.current?.moved && tip(e, item)} onPointerLeave={() => setHover(null)}
                onClick={() => { if (!drag.current?.moved) onSelect(item.id); }} />
            );
          })}
        </g>
      </svg>

      {!topo && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</div>}

      {hover && (
        <div className="pointer-events-none absolute z-10 min-w-44 border border-line bg-raised px-3 py-2 shadow-lift"
          style={{ left: hover.x, top: hover.y, transform: `translate(${hover.flip ? "calc(-100% - 14px)" : "14px"}, -50%)` }}>
          <p className="text-sm font-semibold text-ink">{hover.item.name}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            {hover.item.value != null && (() => { const b = bandFor(hover.item.value, bands); return (
              <span className="chip text-[13px]" style={{ "--chip-fill": b.fill, "--chip-ink": b.ink } as React.CSSProperties}><span className="n">{fmtScore(hover.item.value)}</span><span className="l">{b.label}</span></span>
            ); })()}
            <span className="num">Rank #{hover.item.rank}</span>
          </p>
        </div>
      )}

      <div className="absolute right-3 top-3 flex flex-col border border-line-strong bg-raised shadow-soft">
        <button type="button" onClick={() => zoomBy(1.6)} disabled={view.k >= MAX_K} className="grid size-9 place-items-center text-ink hover:bg-sunken disabled:opacity-40" aria-label="Zoom in"><Plus size={16} /></button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={view.k <= 1} className="grid size-9 place-items-center border-t border-line text-ink hover:bg-sunken disabled:opacity-40" aria-label="Zoom out"><Minus size={16} /></button>
        <button type="button" onClick={() => setView(IDENTITY)} disabled={view.k === 1} className="grid size-9 place-items-center border-t border-line text-ink hover:bg-sunken disabled:opacity-40" aria-label="Reset map view"><Reset size={15} /></button>
      </div>
    </div>
  );
}
