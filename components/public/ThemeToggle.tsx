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

/** Light/dark switch. With no site header (the site is embedded), it floats at the
 *  bottom right of every public page (.theme-fab), under drawers and sheets. */
export function ThemeToggle({ className = "theme-fab" }: { className?: string } = {}) {
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
      title={theme ? `Switch to ${next} theme` : undefined}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
