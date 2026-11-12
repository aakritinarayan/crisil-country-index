"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut } from "@/components/ui/icons";
import { logout } from "@/app/(admin)/admin/actions";

/** The signed-in administrator as a compact button; the panel shows the name (only when
 *  the identity provider supplies one), the email, and Sign out. Escape or a click
 *  elsewhere closes it and returns focus to the button. */
export function AccountMenu({ name, email }: { name: string | null; email: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const initial = (name || email).trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={root} className="relative" onBlur={(e) => { if (open && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        aria-label={`Account: ${name ? `${name}, ` : ""}${email}`} className="account-btn">
        <span aria-hidden className="account-avatar">{initial}</span>
        <span className="hidden max-w-[160px] truncate text-[13.5px] font-semibold text-ink lg:block">{name || email}</span>
        <ChevronDown size={14} className={`text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="account-panel">
        <div className="px-4 py-3">
          {name && <p className="text-[14px] font-semibold text-ink">{name}</p>}
          <p className="break-all text-[13px] text-muted">{email}</p>
        </div>
        <form action={logout} className="border-t border-line p-1.5">
          <button type="submit" className="menu-item w-full"><LogOut size={16} />Sign out</button>
        </form>
      </div>
    </div>
  );
}
