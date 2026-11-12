import { Alert, Check, CircleX } from "@/components/ui/icons";
import type { Actor, Validation, VersionRecord } from "@/lib/admin/types";
import { displayStatus } from "@/lib/admin/workflow";

/* Status and validation labels: text first, a small mark second. Live (a tinted pill, so it
 * stands out in any list); Final — validated, not yet published; Archived — was live, since
 * replaced. An upload that failed validation has no status; its validation label says why. */
export function StatusLabel({ v }: { v: Pick<VersionRecord, "status"> }) {
  const s = displayStatus(v);
  if (s === "live") return <span className="admin-status is-live"><span aria-hidden className="dot" />Live</span>;
  if (s === "final" && v.status === "archived") return <span className="status-text is-archived"><span aria-hidden className="dot" />Archived</span>;
  if (s === "final") return <span className="status-text is-final"><span aria-hidden className="dot" />Final</span>;
  return <span className="text-muted"><span aria-hidden>—</span><span className="sr-only">No status (failed validation)</span></span>;
}

export function ValidationLabel({ v, long = false }: { v: Validation; long?: boolean }) {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  if (!v.passed) return <span className="val is-failed"><CircleX size={15} />Failed{long ? " — " : " · "}{n(v.errors.length, "error")}</span>;
  if (v.warnings.length) return <span className="val is-warn"><Alert size={15} />Passed{long ? " with " : " · "}{n(v.warnings.length, "warning")}</span>;
  return <span className="val is-ok"><Check size={15} />Passed</span>;
}

export const actorName = (a: Actor) => (a.kind === "system" ? "System" : a.name || a.email || a.id);

/** An actor with their email underneath (or as a tooltip when compact). `full` wraps a long
 *  email instead of truncating it — for the details view, where the whole address belongs. */
export function ActorLabel({ actor, compact = false, full = false }: { actor: Actor; compact?: boolean; full?: boolean }) {
  if (actor.kind === "system") return <span className="text-muted">System</span>;
  const email = actor.name && actor.email ? actor.email : null;
  return compact
    ? <span className="block truncate" title={actor.email ?? undefined}>{actorName(actor)}</span>
    : <span className="block min-w-0"><span className="block truncate text-ink">{actorName(actor)}</span>{email && <span className={`block text-[12.5px] text-muted ${full ? "break-all" : "truncate"}`} title={full ? undefined : email}>{email}</span>}</span>;
}
