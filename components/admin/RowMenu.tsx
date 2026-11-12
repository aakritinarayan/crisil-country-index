"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Download, Eye, More, Publish, Restore } from "@/components/ui/icons";
import type { VersionActions } from "@/lib/admin/permissions";

/** The per-version overflow menu: details, then the less frequent actions. An
 *  unavailable action is listed with the reason rather than hidden. */
export function RowMenu({ label, href, actions }: { label: string; href: string; actions: VersionActions }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const items = [
    { key: "preview", text: "Preview", icon: Eye, state: actions.preview },
    actions.publish && { key: "publish", text: "Publish…", icon: Publish, state: actions.publish },
    actions.restore && { key: "restore", text: "Restore this version…", icon: Restore, state: actions.restore },
    { key: "download", text: "Download source workbook", icon: Download, state: actions.download },
  ].filter(Boolean) as { key: string; text: string; icon: typeof Eye; state: { enabled: boolean; reason?: string } }[];

  return (
    <div ref={root} className="relative" onBlur={(e) => { if (open && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} aria-label={`More actions for ${label}`} className="admin-icon-btn is-small"><More size={18} /></button>
      <div id={id} hidden={!open} className="account-panel !w-[268px]">
        <div className="p-1.5">
          <Link href={href} className="menu-item">View details</Link>
          {items.map(({ key, text, icon: Icon, state }) => key === "preview" && state.enabled ? (
            <a key={key} href={`/admin/preview/${href.split("/").pop()}`} target="_blank" rel="noopener" className="menu-item"><Icon size={16} />{text}<span className="sr-only"> (opens in a new tab)</span></a>
          ) : (
            <button key={key} type="button" aria-disabled={!state.enabled || undefined} className="menu-item">
              <Icon size={16} />
              <span className="min-w-0 text-left">{text}{!state.enabled && state.reason && <span className="block text-[12px] font-normal leading-snug text-muted">{state.reason}</span>}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
