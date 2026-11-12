"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowUpRight } from "@/components/ui/icons";
import { ADMIN_HINT_COOKIE } from "@/lib/admin/hint";

/** A way back to the console for administrators only: shown when this browser signed in
 *  to the admin (the hint cookie), never to public visitors, and without a server check —
 *  public pages stay static. The hint grants nothing; /admin checks the real session. */
const hasHint = () => document.cookie.split("; ").some((c) => c === `${ADMIN_HINT_COOKIE}=1`);
const noop = () => () => {};

export function AdminShortcut() {
  const show = useSyncExternalStore(noop, hasHint, () => false);
  if (!show) return null;
  return (
    <Link href="/admin" className="admin-fab">
      Admin<ArrowUpRight size={14} />
    </Link>
  );
}
