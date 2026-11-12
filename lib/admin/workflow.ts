import type { Actor, VersionRecord } from "./types";

/* The update workflow, in one place:
 *
 *   upload final workbook → validate → review changes → approval (if required) → publish
 *
 * Confirmed with the client: only internally finalised workbooks are uploaded, so an
 * accepted upload is "Final" (never a draft); the only other visible status is "Live".
 * Validation and change review always happen.
 *
 * Not yet confirmed — each is a setting here, not a hardcoded rule:
 *   - a second approval, probably from another administrator (ADMIN_REQUIRE_APPROVAL)
 *   - publishing an earlier version again, i.e. rollback (ADMIN_ALLOW_ROLLBACK)
 * TODO(decision): settle both with the client, then keep or remove the setting.
 *
 * Pure functions (no server-only imports) so the rules are unit-tested (tests/workflow). The
 * store enforces them on every write; the console only uses them to explain. */

export type WorkflowSettings = {
  approvalRequired: boolean;   // a different administrator than the uploader approves before publishing
  rollback: boolean;           // an earlier Final version may be published again
};

export const workflowSettings = (env: Record<string, string | undefined> = process.env): WorkflowSettings => ({
  approvalRequired: env.ADMIN_REQUIRE_APPROVAL === "true",
  rollback: env.ADMIN_ALLOW_ROLLBACK !== "false",
});

/** What the console calls a version. Internally a version is still draft / published /
 *  archived (DATA_MODEL), but the client asked for a simple Final / Live: an accepted upload
 *  that isn't live is Final, whether or not it was live before. An upload that failed
 *  validation has no status — it never became a version. */
export type DisplayStatus = "live" | "final" | null;
export const displayStatus = (v: Pick<VersionRecord, "status">): DisplayStatus =>
  v.status === "published" ? "live" : v.status === "rejected" ? null : "final";

const sameAdmin = (a: Actor | null | undefined, b: Actor | null | undefined) => !!a && !!b && a.kind === "admin" && b.kind === "admin" && a.id === b.id;

export const isApproved = (v: Pick<VersionRecord, "approved_by">) => !!v.approved_by;

/** Whether a version needs an approval it doesn't have yet. */
export const awaitingApproval = (v: Pick<VersionRecord, "status" | "approved_by">, s: WorkflowSettings) =>
  s.approvalRequired && displayStatus(v) === "final" && !isApproved(v);

/** Why `actor` can't approve this version, or null if they can. */
export function approveBlocker(v: VersionRecord, actor: Actor, s: WorkflowSettings): string | null {
  if (!s.approvalRequired) return "Approval isn’t required";
  if (displayStatus(v) !== "final") return v.status === "rejected" ? "This upload failed validation" : "This version is already live";
  if (isApproved(v)) return "Already approved";
  if (sameAdmin(v.created_by, actor)) return "You uploaded this workbook — another administrator must approve it";
  return null;
}

/** Why this version can't be published now, or null if it can. `live` is the version
 *  currently on the public site, if any. Applies whoever asks; capabilities are separate. */
export function publishBlocker(v: VersionRecord, live: Pick<VersionRecord, "version"> | null, s: WorkflowSettings): string | null {
  if (v.status === "rejected" || !v.validation.passed) return "This upload failed validation";
  if (v.status === "published") return "This version is already live";
  if (isEarlier(v, live) && !s.rollback) return "Publishing an earlier version again isn’t enabled";
  if (awaitingApproval(v, s)) return "Needs approval by another administrator first";
  return null;
}

/** An earlier version than the one that's live — publishing it is a rollback. */
export const isEarlier = (v: Pick<VersionRecord, "version">, live: Pick<VersionRecord, "version"> | null) =>
  live?.version != null && v.version != null && v.version < live.version;
