"use client";
import { useEffect, useRef } from "react";

/** The closing section's warm light. On a desktop pointer it leans a little towards the
 *  cursor (±12% of the width, eased by CSS); touch, small screens and reduced motion keep
 *  it centred. One rAF-throttled write of a CSS variable, no re-render. */
export function FooterGlow() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = el.current?.parentElement;
    if (!host) return;
    const ok = window.matchMedia("(pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (!ok.matches || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = host.getBoundingClientRect();
        const x = 50 + ((e.clientX - r.left) / r.width - 0.5) * 24;
        host.style.setProperty("--gx", `${x.toFixed(1)}%`);
      });
    };
    const leave = () => host.style.setProperty("--gx", "50%");
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); };
  }, []);
  return <div ref={el} aria-hidden className="site-footer-glow" />;
}
