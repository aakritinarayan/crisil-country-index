# Country Index — Project handover

Status as of **20 November 2026**. This is the single document to read first; it supersedes the
older status, setup and scripts sections of `README.md` (which still describe the earlier
MongoDB-only prototype, demo workbooks and embed widget — none of those are in the code any
more). The original specification is in `docs/CONTEXT.md`, `FLOW.md`, `DATA_MODEL.md`,
`TECH_SPEC.md`, `BUILD_PLAN.md`; working rules for anyone (or any AI assistant) changing the
code are in `CLAUDE.md`.

> **No secrets or client data are in this repository, and none may be added.** The GitHub repo
> (`aakritinarayan/crisil-country-index`) is **public**. Passwords, connection strings, Crisil's
> workbook and every upload live in Vercel's environment settings, the Neon database, or the
> git-ignored `.data/` folder on the developer's machine.

---

## 1. What it is

A public website that publishes a **global country index — "24/7 Carbon-Free Electricity
Readiness Index"** (working name; the official name is still to be confirmed by Crisil) — plus a
private admin portal where an administrator uploads the assessment workbook, checks it and
publishes it.

| | URL |
|---|---|
| Public site | https://crisil-country-index.vercel.app |
| Methodology | https://crisil-country-index.vercel.app/methodology |
| Country profile (example) | https://crisil-country-index.vercel.app/country/india |
| Admin portal | https://crisil-country-index.vercel.app/admin |
| Review link (one version, no login) | `/share/<token>` — token held in Vercel env, see §8 |

- **Hosting:** Vercel, project linked to the GitHub repo; every push to `main` deploys to production.
- **Database:** Neon Postgres, provisioned through the Vercel Marketplace (`DATABASE_URL`).
- **Admin account:** one shared account, `admin@countryindex.local`. The password is not in
  this document; it is held by the project owner (locally in `.data/admin-password.txt`).
  **It has appeared in chat history — change it before handing over** (§8).

## 2. What is live right now

| Version | Period | Status | Contents |
|---|---|---|---|
| 12 | Nov 2026 | **Live** | India (real Crisil scores) + Indonesia, Philippines (**placeholders**) |
| 13 | May 2026 | Archived | All three countries **placeholder** — exists only so the rank-history columns have a previous period |
| 1–5 | — | DEMO | Fictional records shown in the version history (`ADMIN_DEMO_DATA=merge`); read-only, never public |
| 6–11 | Nov 2026 | Archived | Earlier test and sample uploads |

Because placeholders are mixed in, the whole dataset is flagged as sample data and the site
shows **"Sample data — not a Crisil assessment"** everywhere. Placeholder rationales say
"Placeholder…", and placeholders carry no sources.

**To go fully real:** upload Crisil's real Indonesia and Philippines assessments with
`sample_data` set to `false` in the workbook's meta tab, and publish. The notice disappears,
and the placeholder May 2026 period stops being used for comparison automatically (real data
is never compared with sample data).

## 3. The assessment framework (Crisil "CSI framework V2")

- **4 weighted pillars** → **15 weighted KPIs** ("parameters" on the site) scored **1–5**
  (1 Low · 3 Moderate · 5 High). Some KPIs are scored once per **procurement route** (6 routes)
  and averaged.
- Pillar score (0–100) = weighted KPI average ÷ 5 × 100. Composite = weighted pillar average.
- **Readiness bands:** Low 0–39 · Moderate 40–69 · High 70–100 (placeholder until Crisil confirms).
- **A KPI with no score is "not assessed"**: left out, its pillar's other weights scaled up —
  never counted as zero (agreed with the client; Crisil's own sheet scored it 0).
- **Assessment scope:** India, Indonesia, Philippines (the workbook's countries tab). A country
  in scope without scores is shown as "not yet assessed" — never ranked, coloured or profiled.
- Maths: `lib/cfe/compute.ts` (tested against the workbook's own formulas).

## 4. Public site — features

- **Hero:** index-wide figures only (countries assessed, pillar count, data period) — never one
  country's name or score (client decision: it is a global index).
- **Country Explorer:** 3-D globe and flat map; search by name or ISO code; assessment tabs
  (Overview, Composite, each pillar) that colour the map. The **country panel follows the tab**:
  Overview/Composite → composite score, band, rank and all pillars; a pillar → that pillar's
  score, band, rank and **its parameters only**. Every score opens a drawer with rationale and sources.
- **Country rankings:** ranked or A–Z, search, band filter, rank by composite or any pillar;
  **Previous ranking** and **Movement vs. previous** (tinted ▲/▼ chips) for the active measure.
  Phones get an expandable list instead of the table.
- **Global performance:** distribution of countries across bands, per assessment.
- **Country profile pages** (`/country/<slug>`), and a "not yet assessed" page for in-scope
  countries without scores. **Methodology** page from the workbook's text.
- Light/dark theme, skeleton loaders, responsive from 320px, WCAG AA aim (score never
  colour-alone).

### How rank movement works (`lib/ranking.ts`, `lib/admin/history.ts`)

- Previous period = the latest **published** version with an **earlier reporting period**, of the
  same kind (real vs real, sample vs sample). Re-publishing within the same month is a
  correction, not a previous period.
- Movement = previous rank − current rank, on the measure being ranked. Ties share a rank (1, 2, 2, 4).
- Movement is shown only if both periods ranked **the same countries** on that measure;
  otherwise "—" with the reason. Nothing is ever inferred.

## 5. Admin portal — monthly workflow

Upload final workbook → **validate** (every problem in one pass) → **review changes** against
the live version → **approval** (only if switched on) → **publish**. The public site updates
within seconds.

- Statuses: **Live**, **Final** (validated, not yet published), **Archived** (was live, replaced).
  Failed uploads keep no status. Nothing is ever deleted; every upload file is kept.
- Uploaded-by, approved-by and published-by are recorded separately; the audit trail is
  append-only (enforced by database triggers).
- **Template:** the admin downloads it pre-filled with the latest data (Upload page), edits,
  re-uploads. Format: `lib/cfe/template.ts`. Validation rules: `lib/cfe/validate.ts`.
  Scores off the 1/3/5 levels and missing sources are warnings, not errors.
- **Preview** shows the full public site from any version, for that admin only.
- **Settings awaiting the client** (env vars, not hardcoded):
  `ADMIN_REQUIRE_APPROVAL` (second administrator approves; default off) and
  `ADMIN_ALLOW_ROLLBACK` (re-publish an earlier version; default on).

## 6. Code map

| Area | Where |
|---|---|
| Public pages | `app/(public)/` — home, `country/[slug]`, `methodology` |
| Explorer, rankings, distribution | `components/public/explorer/` (shared state in `ExplorerContext.tsx`) |
| Hero | `components/public/hero/` |
| Admin pages | `app/(admin)/admin/`; components in `components/admin/` |
| Data read for the public site | `lib/data.ts` (`getPublishedSnapshot` — cached, tag `index-data`) |
| Ranking & history | `lib/ranking.ts`, `lib/admin/history.ts` |
| Framework parse / validate / compute | `lib/cfe/` |
| Version rules & storage | `lib/admin/store.ts`, `workflow.ts`, `permissions.ts`; backends `backend-postgres.ts` (live), `backend-local.ts` (dev), `backend-cloud.ts` (Mongo + Azure, unused) |
| Review links | `lib/share.ts`, `app/share/[token]/` |
| Auth | `lib/auth.ts` (Auth.js credentials, single shared admin) |
| Tests | `tests/*.test.mjs` — `npm test` (20 tests: compute, template, workflow, ranking) |

Stack: Next.js 16 (App Router, Cache Components), React 19, Tailwind, Auth.js, exceljs, zod,
d3-geo + world-atlas (maps), recharts, `@neondatabase/serverless`. Ask before adding dependencies.

**Caching:** public pages are static. Publishing calls `updateTag("index-data")`, which is the
whole "go live" mechanism — the database is never read per visitor.

## 7. Running it locally

```bash
npm install
# .env.local: AUTH_SECRET, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD_HASH (npm run admin:password -- "…"),
# optionally ADMIN_TIME_ZONE, ADMIN_DEMO_DATA=false|merge. Escape every $ as \$ in this file.
npm run dev            # http://localhost:3000 — without DATABASE_URL the admin stores versions in .data/admin
npm test
npm run build
```

- With nothing published, the site says "not published yet" (it no longer falls back to the
  bundled 196-country sample unless `DATASET=sample` is set, for design work).
- `npm run cfe:import -- "<Crisil workbook>.xlsx"` converts Crisil's own layout into the
  framework once (output in `.data/cfe/`).
- `scripts/check/cdp.mjs` drives headless Chrome for screenshot checks.

## 8. Environment variables (Vercel → Production)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (set by the Marketplace integration) |
| `AUTH_SECRET` | session signing |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD_HASH` | the shared admin account |
| `ADMIN_TIME_ZONE` | `Asia/Kolkata` |
| `ADMIN_DEMO_DATA` | `merge` (show DEMO history) — set `false` for a clean history |
| `ADMIN_REQUIRE_APPROVAL`, `ADMIN_ALLOW_ROLLBACK` | workflow switches (unset = off / on) |
| `SHOW_SAMPLE_DATA_BANNER` | unset/true; the notice also needs the data to be flagged sample |
| `SHARE_TOKEN`, `SHARE_PAYLOAD` | review link (`npm run share:link`); delete both to revoke |

**Change the admin password:** `npm run admin:password -- "<new password, 12+ chars>"`, paste the
*raw* hash into `ADMIN_PASSWORD_HASH` on Vercel, redeploy. Rotating `AUTH_SECRET` signs everyone out.

## 9. Open items

**Waiting on Crisil**
1. Real Indonesia and Philippines assessments (replace the placeholders; set `sample_data` false).
2. Official index name — and "energy" vs "electricity" in "24/7 CFE".
3. Readiness band thresholds (Low/Moderate/High are placeholders).
4. Whether publishing needs a second approver; whether rollback is allowed.
5. Brand kit — the site deliberately carries no Crisil branding yet.

**Before client handover**
- Change the admin password (it has appeared in chat history).
- Decide whether to keep the DEMO history (`ADMIN_DEMO_DATA`) and the placeholder May 2026 period.
- Retire the old review link (delete `SHARE_TOKEN`/`SHARE_PAYLOAD`) if no longer needed.
- Transfer the Vercel project, Neon database and GitHub repo to the client's accounts, and
  consider making the repo private.
- The stale GitHub Pages prototype (`aakritinarayan.github.io/crisil-country-index`) should not be shared.

**Known gaps**
- Accessibility audit (Lighthouse / screen reader pass) not yet done formally.
- No automated end-to-end test of upload → publish (unit tests cover the rules).
- `README.md` sections on seeding, demo files and embedding are out of date (see top of this file).
- Out of scope for v1: trend charts, country comparison, PDF/CSV export, multiple languages,
  public API, automated file-watching, email/Teams approvals.
