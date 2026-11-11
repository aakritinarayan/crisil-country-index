"use client";
import { useEffect, useRef, useState } from "react";
import { Collapse, Crosshair, Expand, Minus, Plus, Reset } from "@/components/ui/icons";

/** One compact control group for both geographic views (upper right): zoom in / out,
 *  fit to the selected country, reset, and expand to the full-screen workspace. Each
 *  button has a tooltip and an accessible label; zoom buttons disable at their limits. */
export function MapControls({ onZoomIn, onZoomOut, canZoomIn, canZoomOut, onFit, canFit, onReset, canReset, expanded, onExpand, resetLabel }: {
  onZoomIn: () => void; onZoomOut: () => void; canZoomIn: boolean; canZoomOut: boolean;
  onFit: () => void; canFit: boolean; onReset: () => void; canReset: boolean;
  expanded: boolean; onExpand: () => void; resetLabel: string;
}) {
  const b = (label: string, on: () => void, enabled: boolean, icon: React.ReactNode, extra?: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={on} disabled={!enabled} aria-label={label} data-tip={label} {...extra}>{icon}</button>
  );
  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      {b("Zoom in", onZoomIn, canZoomIn, <Plus size={15} />)}
      {b("Zoom out", onZoomOut, canZoomOut, <Minus size={15} />)}
      <span className="map-controls-gap" aria-hidden />
      {b("Fit to selected country", onFit, canFit, <Crosshair size={15} />)}
      {b(resetLabel, onReset, canReset, <Reset size={14} />)}
      <span className="map-controls-gap" aria-hidden />
      {b(expanded ? "Exit expanded map" : "Expand map", onExpand, true, expanded ? <Collapse size={15} /> : <Expand size={15} />, { "aria-pressed": expanded })}
    </div>
  );
}

/** Wheel zoom that respects the page. Trackpad pinch (a ctrl-wheel) and Ctrl/⌘ + scroll
 *  always zoom. A plain wheel zooms once the visitor has engaged the map (pressed inside
 *  it, until the pointer leaves) or in the expanded workspace; otherwise the page scrolls
 *  and a short hint explains how to zoom — the embedded-maps convention. */
export function useWheelZoom(el: React.RefObject<HTMLElement | null>, expanded: boolean, onZoom: (factor: number, x: number, y: number) => void) {
  const [hint, setHint] = useState(false);
  const engaged = useRef(false);
  const timer = useRef(0);
  const latest = useRef({ expanded, onZoom });
  useEffect(() => { latest.current = { expanded, onZoom }; });

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      const pinch = e.ctrlKey || e.metaKey;
      if (!pinch && !engaged.current && !latest.current.expanded) {
        setHint(true);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHint(false), 1400);
        return; // let the page scroll
      }
      e.preventDefault();
      setHint(false);
      const r = node.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      onZoomRef(Math.exp(-dy * (pinch ? 0.012 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
    };
    const onZoomRef = (f: number, x: number, y: number) => latest.current.onZoom(f, x, y);
    const down = () => { engaged.current = true; };
    const leave = () => { engaged.current = false; };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointerleave", leave);
    return () => { node.removeEventListener("wheel", wheel); node.removeEventListener("pointerdown", down); node.removeEventListener("pointerleave", leave); clearTimeout(timer.current); };
  }, [el]);

  return hint;
}

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export function WheelHint({ show }: { show: boolean }) {
  return (
    <div aria-hidden className={`map-hint ${show ? "is-on" : ""}`}>
      <span>{MAC ? "Use ⌘ + scroll, or pinch, to zoom the map" : "Use Ctrl + scroll, or pinch, to zoom the map"}</span>
    </div>
  );
}

/** A tween for programmatic camera moves (buttons, fit, selection). Reduced motion jumps. */
export function tween(ms: number, step: (e: number) => void, done?: () => void) {
  let raf = 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { step(1); done?.(); return () => {}; }
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    step(t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
    if (t < 1) raf = requestAnimationFrame(tick); else done?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
