import "server-only";
import { sampleSnapshot } from "@/lib/data";
import type { Actor, AuditEvent, ChangeSummary, VersionRecord } from "./types";

/* Demonstration records for the admin console (ADMIN_DEMO_DATA=true) — a prototype state
 * while upload and publish are not connected. Clearly fictional: placeholder identities on
 * example.com, no stored workbooks, and nothing here drives the public site, which keeps
 * serving the bundled sample dataset. The console says so wherever these appear.
 *
 * The story it tells: two administrators; uploads by one published by the other; a
 * rejected upload; a rollback; a correction for the same reporting period; a Final version not yet published. */

const A: Actor = { kind: "admin", id: "demo-admin-a", name: "Demo administrator A", email: "demo-a@example.com" };
const B: Actor = { kind: "admin", id: "demo-admin-b", name: "Demo administrator B", email: "demo.administrator.b.research-data-team@example.com" };
const SYS: Actor = { kind: "system", id: "system" };

const id = (n: number) => `00000000-demo-4000-8000-${String(n).padStart(12, "0")}`;
const none = { passed: true, errors: [], warnings: [] };
const deadLink = (row: number) => ({ code: "reference.unreachable", message: "Reference URL did not respond (HTTP 404). Publishing is still allowed.", tab: "references", row, column: "url" });

export async function demoData(): Promise<{ versions: VersionRecord[]; events: AuditEvent[] }> {
  const p = sampleSnapshot();
  const counts = p ? { countries: p.countries.length, pillars: p.pillars.length } : null;
  const moves = p ? largestMoves(p) : [];
  const changes = (against: number | null, s: Partial<ChangeSummary>): ChangeSummary => ({
    against_version: against, scores_changed: 0, rationales_edited: 0, sources_added: 0, sources_removed: 0,
    countries_added: 0, countries_removed: 0, largest_moves: [], ...s,
  });

  const versions: VersionRecord[] = [
    { id: id(1), version: 1, as_of: "2026-06", status: "archived",
      source_file: { filename: "country-index-jun-2026.xlsx", size_bytes: 186_420, uploaded_at: "2026-07-03T09:12:00Z" },
      created_at: "2026-07-03T09:12:00Z", created_by: A, published_at: "2026-07-04T05:40:00Z", published_by: B,
      validation: none, changes: null, counts },
    { id: id(2), version: 2, as_of: "2026-07", status: "archived",
      source_file: { filename: "country-index-jul-2026.xlsx", size_bytes: 188_903, uploaded_at: "2026-08-05T08:30:00Z" },
      created_at: "2026-08-05T08:30:00Z", created_by: A, published_at: "2026-09-10T11:05:00Z", published_by: B,
      validation: { passed: true, errors: [], warnings: [deadLink(214), deadLink(530)] },
      changes: changes(1, { scores_changed: 22, rationales_edited: 11, sources_added: 4, largest_moves: moves.slice(0, 3) }), counts },
    { id: id(3), version: null, as_of: "2026-08", status: "rejected",
      source_file: { filename: "country-index-aug-2026.xlsx", size_bytes: 190_115, uploaded_at: "2026-09-02T10:02:00Z" },
      created_at: "2026-09-02T10:02:00Z", created_by: B, published_at: null, published_by: null,
      validation: { passed: false, warnings: [], errors: [
        { code: "score.out_of_range", message: "Score 104 is outside the scale 0–100.", tab: "scores", row: 87, column: "score" },
        { code: "pillar.unknown", message: "pillar_id “infra_v2” is not defined in the pillars tab.", tab: "scores", row: 412, column: "pillar_id" },
        { code: "reference.missing_title", message: "Reference has a URL but no title.", tab: "references", row: 51, column: "title" },
      ] }, changes: null, counts: null },
    { id: id(4), version: 3, as_of: "2026-08", status: "archived",
      source_file: { filename: "country-index-aug-2026-corrected.xlsx", size_bytes: 190_204, uploaded_at: "2026-09-03T07:45:00Z" },
      created_at: "2026-09-03T07:45:00Z", created_by: B, published_at: "2026-09-04T06:20:00Z", published_by: A,
      validation: none, changes: changes(2, { scores_changed: 31, rationales_edited: 17, sources_added: 6, sources_removed: 2, largest_moves: moves.slice(1, 4) }), counts },
    { id: id(5), version: 4, as_of: "2026-09", status: "published",
      source_file: { filename: "country-index-monthly-assessment-september-2026-final-reviewed-v2.xlsx", size_bytes: 191_770, uploaded_at: "2026-10-06T09:55:00Z" },
      created_at: "2026-10-06T09:55:00Z", created_by: B, published_at: "2026-10-07T04:30:00Z", published_by: A,
      validation: { passed: true, errors: [], warnings: [deadLink(77)] },
      changes: changes(2, { scores_changed: 18, rationales_edited: 9, sources_added: 3, sources_removed: 1, largest_moves: moves.slice(0, 4) }), counts },
    { id: id(6), version: 5, as_of: "2026-10", status: "draft",
      source_file: { filename: "country-index-oct-2026.xlsx", size_bytes: 192_318, uploaded_at: "2026-11-04T10:42:00Z" },
      created_at: "2026-11-04T10:42:00Z", created_by: A, published_at: null, published_by: null,
      validation: { passed: true, errors: [], warnings: [deadLink(301)] },
      changes: changes(4, { scores_changed: 14, rationales_edited: 9, sources_added: 3, largest_moves: moves.slice(2, 6) }), counts },
  ];

  let n = 0;
  const ev = (type: AuditEvent["type"], at: string, actor: Actor, version_id: string, data?: AuditEvent["data"]): AuditEvent =>
    ({ id: `demo-event-${++n}`, type, at, actor, version_id, data });
  const uploaded = (v: VersionRecord) => {
    const t = v.created_at;
    const later = new Date(Date.parse(t) + 40_000).toISOString();
    return [
      ev("upload.received", t, v.created_by, v.id, { filename: v.source_file.filename, size_bytes: v.source_file.size_bytes }),
      v.validation.passed
        ? ev("validation.passed", later, SYS, v.id, { warnings: v.validation.warnings.length })
        : ev("validation.failed", later, SYS, v.id, { errors: v.validation.errors.length }),
      ...(v.validation.passed ? [ev("draft.created", later, SYS, v.id, { version: v.version })] : []),
    ];
  };
  const [v1, v2, rej, v3, v4, v5] = versions;
  const events: AuditEvent[] = [
    ...uploaded(v1), ev("version.published", "2026-07-04T05:40:00Z", B, v1.id, { version: 1 }),
    ...uploaded(v2), ev("version.published", "2026-08-06T05:15:00Z", B, v2.id, { version: 2, replaced_version: 1 }),
    ev("version.archived", "2026-08-06T05:15:00Z", SYS, v1.id, { replaced_by_version: 2 }),
    ...uploaded(rej),
    ...uploaded(v3), ev("version.published", "2026-09-04T06:20:00Z", A, v3.id, { version: 3, replaced_version: 2 }),
    ev("version.archived", "2026-09-04T06:20:00Z", SYS, v2.id, { replaced_by_version: 3 }),
    // a problem found in version 3: version 2 restored the same week
    ev("version.restored", "2026-09-10T11:05:00Z", B, v2.id, { version: 2, replaced_version: 3, note: "Rolled back while version 3 was checked" }),
    ev("version.archived", "2026-09-10T11:05:00Z", SYS, v3.id, { replaced_by_version: 2 }),
    ...uploaded(v4), ev("version.published", "2026-10-07T04:30:00Z", A, v4.id, { version: 4, replaced_version: 2 }),
    ev("version.archived", "2026-10-07T04:30:00Z", SYS, v2.id, { replaced_by_version: 4 }),
    ...uploaded(v5),
  ];
  return { versions: versions.map((v) => ({ ...v, demo: true as const })), events };
}

/** The highest demonstration version number: real uploads shown alongside continue after it. */
export const DEMO_LAST_VERSION = 5;

/** Plausible score movements built from the bundled sample (real country and pillar
 *  names, current score as "after"), so the change summary has something to show. */
function largestMoves(p: ReturnType<typeof sampleSnapshot>) {
  const deltas = [-9, 7, -6, 5, 4, -4];
  const pillars = [...p.pillars].sort((a, b) => a.display_order - b.display_order);
  return deltas.map((d, i) => {
    const c = p.countries[(i * 37) % p.countries.length];
    const pl = pillars[i % pillars.length];
    const after = p.scores.find((s) => s.country_id === c.country_id && s.pillar_id === pl.pillar_id)?.score ?? 60;
    return { country: c.name, pillar: pl.name, before: Math.min(p.meta.score_max, Math.max(p.meta.score_min, after - d)), after };
  });
}
