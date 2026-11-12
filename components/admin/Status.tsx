import { Alert, Check, CircleX } from "@/components/ui/icons";
import type { Actor, Validation, VersionStatus } from "@/lib/admin/types";

/* Status and validation labels: text first, a small mark second. Only the live version
 * gets a tinted pill, so it stands out in any list. */
export function StatusLabel({ status }: { status: VersionStatus }) {
  if (status === "published") return <span className="admin-status is-live"><span aria-hidden className="dot" />Live</span>;
  const text = { draft: "Draft", archived: "Archived", rejected: "Rejected" }[status];
  return <span className={`status-text is-${status}`}><span aria-hidden className="dot" />{text}</span>;
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
