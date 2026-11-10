"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/ui/icons";

type Theme = "light" | "dark";

export function ThemeToggle() {
  // The pre-paint script in app/layout.tsx has already set data-theme.
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch { /* storage blocked: still switches for this visit */ }
        setTheme(next);
      }}
      className="grid size-10 place-items-center border border-line-strong bg-raised text-ink hover:shadow-soft"
      aria-label={theme ? `Switch to ${next} theme` : "Switch theme"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
