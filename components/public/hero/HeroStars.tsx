"use client";
import { useEffect, useRef } from "react";

/** A very faint star field behind the hero. Still by default — no twinkle, no drift, so
 *  nothing moves on its own. It answers the pointer only: stars near it brighten a little
 *  and the field shifts a few pixels with depth. Reduced motion keeps the brightening and
 *  drops the shift. Decorative and aria-hidden. */
export function HeroStars() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const host = c.parentElement!;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stars: { x: number; y: number; r: number; a: number; z: number }[] = [];
    let w = 0, h = 0, raf = 0;
    const pointer = { x: -1e4, y: -1e4, px: 0, py: 0 };

    const build = () => {
      // seeded afresh on every build, so the field is the same on every visit and every resize
      const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = host.offsetWidth; h = host.offsetHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 18000);
      stars = Array.from({ length: n }, () => ({ x: rand() * w, y: rand() * h, r: 0.35 + rand() * 0.75, a: 0.08 + rand() * 0.28, z: 0.2 + rand() * 0.8 }))
        // keep the headline area quieter: thin out stars behind the text block
        .filter((s) => !(Math.abs(s.x - w / 2) < Math.min(560, w * 0.4) && s.y < h * 0.62) || rand() < 0.35);
      draw();
    };
    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      const shift = reduce.matches ? 0 : 1;
      for (const s of stars) {
        const x = s.x - pointer.px * s.z * 10 * shift, y = s.y - pointer.py * s.z * 10 * shift;
        const d = Math.hypot(x - pointer.x, y - pointer.y);
        const lift = d < 140 ? (1 - d / 140) ** 2 : 0;
        ctx.globalAlpha = Math.min(0.9, s.a + lift * 0.55);
        ctx.fillStyle = lift > 0.2 ? "#bff3ee" : "#e4efed";
        ctx.beginPath();
        ctx.arc(x, y, s.r + lift * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
      pointer.px = pointer.x / w - 0.5; pointer.py = pointer.y / h - 0.5;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const leave = () => { pointer.x = pointer.y = -1e4; if (!raf) raf = requestAnimationFrame(draw); };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(host);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); };
  }, []);

  return <canvas ref={canvas} aria-hidden className="stars pointer-events-none absolute inset-0 -z-10 size-full" />;
}
