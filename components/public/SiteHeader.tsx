"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Close, Search } from "@/components/ui/icons";
import type { CountryOption } from "./CountryCombobox";
import { HeaderSearch, type HeaderSearchHandle } from "./HeaderSearch";
import { ThemeToggle } from "./ThemeToggle";

const SAMPLE_NOTE = "Sample data — not a Crisil assessment";

/** The global header: sticky, translucent and blurred, and adaptive. It takes a dark tone
 *  while a section marked `data-header-tone="dark"` sits behind it (the hero), and the
 *  light tone everywhere else; on the homepage the shared hand-off backdrop (--bg-mix)
 *  must also still be dark, so the header switches exactly when what is behind it does.
 *  The check runs on the scroll frame against the header's own band, not a fixed scroll
 *  offset. Dark theme is always the dark tone.
 *
 *  Phones: identity, a search button that opens a full-width search row, and a menu. */
export function SiteHeader({ countries, sample }: { countries: CountryOption[]; sample: boolean }) {
  const path = usePathname();
  const [tone, setTone] = useState<"dark" | "light">(path === "/" ? "dark" : "light");
  const [active, setActive] = useState<"map" | "rankings" | "methodology" | null>(null);
  const [panel, setPanel] = useState<"search" | "menu" | null>(null);
  const header = useRef<HTMLElement>(null);
  const desk = useRef<HeaderSearchHandle>(null);
  const mobile = useRef<HeaderSearchHandle>(null);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const h = header.current?.offsetHeight ?? 64;
      const root = document.documentElement;
      const mix = parseFloat(getComputedStyle(root).getPropertyValue("--bg-mix") || "0");
      const behindDark = [...document.querySelectorAll<HTMLElement>('[data-header-tone="dark"]')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= h + 1 && r.bottom > 0; // touching counts: at the top the hero starts right under the bar
      });
      const dark = root.dataset.theme === "dark" || (behindDark && (!root.classList.contains("tx-ready") || mix < 0.5));
      setTone(dark ? "dark" : "light");
      // active section: whichever of the explorer / rankings holds the viewport's upper third
      const probe = window.innerHeight * 0.33;
      const inView = (id: string) => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; };
      setActive(path.startsWith("/methodology") ? "methodology" : inView("rankings") ? "rankings" : inView("map") ? "map" : null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const mo = new MutationObserver(onScroll);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); mo.disconnect(); };
  }, [path]);

  // "/" (or Ctrl/⌘ K) focuses search unless the visitor is typing somewhere else
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) desk.current?.focus();
        else { setPanel("search"); requestAnimationFrame(() => mobile.current?.focus()); }
      }
      if (e.key === "Escape" && panel) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const links = [
    { key: "map" as const, href: "/#map", label: "Map" },
    { key: "rankings" as const, href: "/#rankings", label: "Rankings" },
    { key: "methodology" as const, href: "/methodology", label: "Methodology" },
  ];

  return (
    <header ref={header} data-tone={tone} className="site-header sticky top-0 z-40">
      <div className="wrap flex h-16 items-center gap-3 lg:gap-5">
        {/* No client branding until the brand kit is approved (CONTEXT §7). */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight">
          <span aria-hidden className="relative size-7">
            <span className="absolute inset-0 rounded-full bg-[var(--brand)]" />
            <span className="absolute inset-y-0 left-3 right-[-6px] rounded-full bg-[var(--teal)] mix-blend-multiply dark:mix-blend-normal" />
          </span>
          Country Index
        </Link>
        {sample && <p className="hd-note hidden border-l pl-3 text-[12px] leading-tight xl:block">{SAMPLE_NOTE}</p>}

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 text-[14.5px] md:flex">
          {links.map((l) => (
            <Link key={l.key} href={l.href} aria-current={active === l.key ? "location" : undefined}
              className={`hd-link relative px-2.5 py-2 lg:px-3 ${active === l.key ? "is-active" : ""}`}>{l.label}</Link>
          ))}
        </nav>
        <HeaderSearch ref={desk} countries={countries} className="hidden w-[220px] md:block lg:w-[260px]" />
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <button type="button" onClick={() => { setPanel(panel === "search" ? null : "search"); requestAnimationFrame(() => mobile.current?.focus()); }}
            aria-expanded={panel === "search"} aria-controls="hd-panel" aria-label="Find a country" className="hd-icon grid size-10 place-items-center md:hidden"><Search size={18} /></button>
          <ThemeToggle className="hd-icon grid size-10 place-items-center" />
          <button type="button" onClick={() => setPanel(panel === "menu" ? null : "menu")} aria-expanded={panel === "menu"} aria-controls="hd-panel"
            aria-label={panel === "menu" ? "Close menu" : "Open menu"} className="hd-icon grid size-10 place-items-center md:hidden">
            {panel === "menu" ? <Close size={18} /> : <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
          </button>
        </div>
      </div>

      {/* phones: one panel under the bar, either search or the menu */}
      <div id="hd-panel" hidden={!panel} className="hd-panel border-t md:hidden">
        <div className="wrap py-3">
          {panel === "search" && <HeaderSearch ref={mobile} countries={countries} onNavigate={() => setPanel(null)} />}
          {panel === "menu" && (
            <nav aria-label="Main" className="grid">
              {links.map((l) => (
                <Link key={l.key} href={l.href} onClick={() => setPanel(null)} aria-current={active === l.key ? "location" : undefined}
                  className="hd-link flex h-12 items-center border-b text-[16px] last:border-0">{l.label}</Link>
              ))}
              {sample && <p className="hd-note mt-3 text-[12.5px]">{SAMPLE_NOTE}</p>}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
