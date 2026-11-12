/* Admin data model: versions (snapshots) and their append-only audit trail.
 * Mirrors DATA_MODEL.md §3; the payload itself is omitted here — the console only needs
 * the metadata. In production these are Mongo documents; locally, files (lib/admin/store). */

/** Who did something. Always taken from the server session, never from the client. The
 *  name and email are a snapshot at the time of the action, so a later rename doesn't
 *  rewrite history; `id` is the stable key (Auth.js subject / Entra object ID). */
export type Actor =
  | { kind: "admin"; id: string; name: string | null; email: string | null }
  | { kind: "system"; id: "system" };

/** published / draft / archived per DATA_MODEL; a rejected upload is kept (its file is
 *  retained) but never becomes a version — it has no version number. */
export type VersionStatus = "published" | "draft" | "archived" | "rejected";

export type Issue = { code: string; message: string; tab?: string; row?: number; column?: string };
export type Validation = { passed: boolean; errors: Issue[]; warnings: Issue[] };

export type ScoreMove = { country: string; pillar: string; before: number; after: number };
/** Diff against the version that was live when this one was uploaded (FLOW §2). */
export type ChangeSummary = {
  against_version: number | null;
  scores_changed: number;
  rationales_edited: number;
  sources_added: number;
  sources_removed: number;
  countries_added: number;
  countries_removed: number;
  largest_moves: ScoreMove[];
};

export type VersionRecord = {
  id: string;                    // stable record ID (UUID); rejected uploads have only this
  version: number | null;        // monotonic, never reused; null for a rejected upload
  as_of: string;                 // reporting period, YYYY-MM
  status: VersionStatus;
  source_file: { filename: string; size_bytes: number; uploaded_at: string };
  created_at: string;
  created_by: Actor;             // the uploader
  published_at: string | null;   // most recent publication (history lives in the events)
  published_by: Actor | null;
  validation: Validation;
  changes: ChangeSummary | null;
  counts: { countries: number; pillars: number } | null;
};

export type AuditEventType =
  | "upload.received"
  | "validation.passed"
  | "validation.failed"
  | "draft.created"
  | "version.published"
  | "version.restored"           // an earlier version published again (rollback)
  | "version.archived";          // superseded by another publish

/** Append-only: events are only ever added, never edited or removed. */
export type AuditEvent = {
  id: string;
  type: AuditEventType;
  at: string;
  actor: Actor;
  version_id: string;            // VersionRecord.id
  data?: Record<string, string | number | boolean | null>;
};

export const versionLabel = (v: Pick<VersionRecord, "version">) => (v.version != null ? `Version ${v.version}` : "Rejected upload");
