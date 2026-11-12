"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ChevronLeft, Close, Menu } from "@/components/ui/icons";
import { AdminMark } from "./AdminMark";
import { ADMIN_NAV } from "./nav";
import { NAV_KEY as KEY } from "./navState";

/* The collapsed/expanded state lives on <html data-admin-nav> (navState.ts), so the
 * server markup never mismatches. */
const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-admin-nav"] });
  return () => mo.disconnect();
};
const isCollapsed = () => document.documentElement.dataset.adminNav === "collapsed";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="grid gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active = item.match(path);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} data-tip={item.label} className="nav-item">
              <Icon size={18} className="shrink-0" /><span className="nav-label">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** md and up: a rail that collapses to icons (with tooltips) and expands to labels. */
export function Sidebar() {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);
  const toggle = () => {
    const next = !isCollapsed();
    if (next) document.documentElement.dataset.adminNav = "collapsed"; else delete document.documentElement.dataset.adminNav;
    try { localStorage.setItem(KEY, next ? "collapsed" : "expanded"); } catch { /* storage blocked: still toggles */ }
  };
  return (
    <nav aria-label="Admin" className="admin-side hidden md:flex">
      <NavList />
      {/* floats on the rail's edge, halfway down */}
      <button type="button" onClick={toggle} aria-expanded={!collapsed} data-tip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="side-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        <ChevronLeft size={14} />
      </button>
    </nav>
  );
}

/** Below md: a menu button that opens the same navigation in a modal drawer. */
export function MobileNav() {
  const dialog = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  useEffect(() => { dialog.current?.close(); }, [path]);
  return (
    <div className="md:hidden">
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Open navigation" aria-haspopup="dialog"
        className="admin-icon-btn"><Menu size={18} /></button>
      <dialog ref={dialog} aria-label="Admin navigation" className="admin-drawer" onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <AdminMark />
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close navigation" className="admin-icon-btn"><Close size={18} /></button>
        </div>
        <nav aria-label="Admin" className="p-3"><NavList onNavigate={() => dialog.current?.close()} /></nav>
      </dialog>
    </div>
  );
}
