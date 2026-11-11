"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@/components/ui/icons";

type Theme = "light" | "dark";

// The theme lives on <html data-theme> (set before first paint by app/layout.tsx).
const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle({ className = "grid size-10 place-items-center border border-line-strong bg-raised text-ink hover:shadow-soft" }: { className?: string } = {}) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, read, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch { /* storage blocked: still switches for this visit */ }
      }}
      className={className}
      aria-label={theme ? `Switch to ${next} theme` : "Switch theme"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
