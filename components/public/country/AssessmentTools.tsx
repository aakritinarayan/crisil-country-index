"use client";
import { useEffect, useState } from "react";

/** Progressive disclosure for the detailed assessments: an Expand / Collapse all toggle,
 *  and deep links (#pillar_id) that open the matching <details> and scroll to it.
 *  The sections themselves are plain server-rendered <details>, so they work without JS. */
export function AssessmentTools({ containerId }: { containerId: string }) {
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const items = () => [...root.querySelectorAll("details")];
    const sync = () => setAllOpen(items().every((d) => d.open));
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement && root.contains(el)) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
        el.querySelector("summary")?.focus({ preventScroll: true });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    root.addEventListener("toggle", sync, true); // toggle does not bubble; capture it
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      root.removeEventListener("toggle", sync, true);
    };
  }, [containerId]);

  return (
    <button type="button" className="text-[14px] font-semibold text-link underline-offset-4 hover:underline"
      aria-controls={containerId}
      onClick={() => {
        const next = !allOpen;
        document.getElementById(containerId)?.querySelectorAll("details").forEach((d) => { d.open = next; });
      }}>
      {allOpen ? "Collapse all" : "Expand all"}
    </button>
  );
}
