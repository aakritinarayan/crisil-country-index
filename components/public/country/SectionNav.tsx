"use client";
import { useEffect, useState } from "react";

/** A thin in-page navigation under the global header: plain text, teal underline on the
 *  section in view. Links are real anchors (sections carry scroll-margin for the header). */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      let cur = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top < 160) cur = it.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);
  return (
    <nav aria-label="On this page" className="sticky top-16 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
      <ul className="wrap flex gap-6 overflow-x-auto text-[14px] [scrollbar-width:none]">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} aria-current={active === it.id ? "location" : undefined}
              className={`block whitespace-nowrap border-b-2 py-3 transition-colors focus-visible:-outline-offset-2 ${active === it.id ? "border-[var(--teal)] font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
