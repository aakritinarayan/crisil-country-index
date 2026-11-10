# CLAUDE.md

Working rules for this repo. These survive across sessions — read before writing
code. Full spec lives in `docs/CONTEXT.md`, `docs/FLOW.md`, `docs/DATA_MODEL.md`,
`docs/TECH_SPEC.md`, `docs/BUILD_PLAN.md`. This file is the condensed,
load-bearing subset that must never be silently violated.

## State of the build (last session ended 2026-08-12)

- **BUILD_PLAN Phases 0–6 are complete and verified**: data layer, template +
  seed, public site, auth + admin shell, upload + validation, preview +
  publish. Phase 7 (polish/handover) is only partly done — outstanding:
  Lighthouse accessibility pass, the upload→publish integration test,
  `TODO(decision)` comments at every CONTEXT §5 default (only the auth one
  exists, in `lib/auth.ts`), and a full README handover section.
- **Deployed**: `https://crisil-proto.vercel.app` (Vercel + MongoDB Atlas +
  Azure Blob Storage, account `crisil`, container `index-uploads`).
- **Beyond-spec features added at the client's request** (embedding was
  "handled separately" in CONTEXT §2, but was built anyway): chromeless embed
  mode (`?embed=1` — hides header, keeps banner + disclaimer), iframe height
  auto-reporting via postMessage (`HeightReporter`), embed link persistence
  (`EmbedLinkRewriter` keyed off the `data-embed` attr, NOT useSearchParams —
  see that file's comment for why), and a `<country-index-widget>` custom
  element at `public/widget.js`. Demo hosts: `embed-demo.html`,
  `widget-demo.html`. Also: KPI stat tiles, a band-distribution bar chart,
  and a pillar-contribution donut (all data-driven).
- **Demo workbooks** live in `demo-files/` with a README that doubles as a
  demo script. `sample-update.xlsx` in the root is the first one.
- Tests: 59 via `npm test` (node:test, compiled through `tsconfig.test.json`);
  `lib/snapshots.test.ts` self-skips without `MONGODB_URI` and needs a
  replica set (transactions).

## Hard-won gotchas (verified this project, do not re-learn)

- **Local `.env.local` values containing `$` must escape it as `\$`** —
  Next's env loader runs dotenv-expand, which silently truncates bcrypt
  hashes and passwords at `$` otherwise. Hosting-platform env UIs are not
  affected. (Documented in `.env.example`.)
- **`npm run seed` / `npm run reset` write straight to Mongo and cannot
  revalidate the deployed site's cache.** After seeding against Atlas, open
  `/admin`, Preview the published version, and hit Publish once — a no-op in
  the DB that fires `revalidateTag`.
- **`revalidateTag` needs two args in Next 16** — this app uses
  `revalidateTag("index-data", { expire: 0 })` because publish must be
  visible within seconds, not stale-while-revalidate.
- **Never gate visible server-rendered markup behind `useSearchParams()`** —
  it forces that markup out of the static HTML entirely. The embed feature
  uses a pre-paint inline script + CSS attribute selector instead (see
  `components/public/SiteHeader.tsx`).
- **`middleware.ts` is deprecated in Next 16 (→ `proxy.ts`)** — kept as
  `middleware.ts` by explicit user decision (matches TECH_SPEC's literal
  filename); expect the build warning.
- **exceljs**: `addRow()` appends *below* the template's ~500 pre-formatted
  buffer rows — find the last populated row and write at `last + 1` instead.
  Parser must scan to `rowCount`, not `actualRowCount` (a blanked mid-table
  row shrinks the latter and silently drops the sheet's tail — fixed in
  `lib/parse-excel.ts`).
- **recharts animations are disabled** (`isAnimationActive={false}`) — both
  because TECH_SPEC §10 forbids ambient motion and because animated charts
  render blank in headless screenshots.
- Scripts run via `npm run build:scripts` (tsc → `.scripts-build/`), and
  `scripts/seed.ts`/`reset.ts` load `.env.local` through `@next/env` — plain
  `node` won't see env vars without that.

## User working preferences (observed)

- Ask before adding ANY dependency not named in TECH_SPEC §1.
- The docs win over defaults; deviations need asking first, with the why.
- When the user is under deadline pressure they will say to skip tests —
  respect it in the moment, but still verify the happy path end-to-end
  before calling something done.
- Verify UI work with a real browser and real infra (headless Chrome +
  Docker Mongo replica set + Azurite), not by reading code.
- The user's real Atlas password and Azure storage key appeared in this
  chat's history and screenshots — rotation was recommended twice; if
  credentials come up again, remind them once.

## Non-negotiables (CONTEXT.md §7)

- **Sanitise all text before storage, not just before render.** Rationale,
  summary, and every other workbook-sourced text field gets HTML stripped on
  ingest. Never `dangerouslySetInnerHTML` on anything that originated from the
  workbook. One missed call site and the site is defaceable.
- **Sample-data banner while data is placeholder.** Site-wide, persistent:
  "Sample data — not a Crisil assessment". Pair with `robots: noindex, nofollow`
  until real data lands. Controlled by `SHOW_SAMPLE_DATA_BANNER`.
- **No Crisil branding yet.** No logo, no brand colours, no company name in UI
  chrome until the brand kit arrives. Neutral styling only.
- **Disclaimer slot, always present.** Footer block populated from
  `meta.disclaimer`. Reserve the layout space now even with placeholder text.
- **Every published snapshot names who published it and when.** `published_by`
  / `published_at` (and `created_by` / `created_at`) are not optional fields.
- **Accessibility floor on every public page.** Semantic HTML, visible keyboard
  focus, WCAG 2.1 AA contrast, respects reduced motion, usable at 320px. Score
  is never colour-alone — always numeral + band colour + text label together.

## Working notes (BUILD_PLAN.md, end)

- **Data layer before UI.** `DATA_MODEL.md` shapes are the contract. Get
  `schema.ts`, `parse-excel.ts`, `validate.ts`, `bands.ts`, `snapshots.ts` right
  first — the UI phases are assembly, not redesign, if this is solid.
- **The validation layer is the product.** The dashboard itself is
  straightforward; what actually protects the client is the code that stops a
  bad number reaching a public page carrying their name. Spend the care there,
  not on UI polish.
- **Don't optimise prematurely.** Fifteen records today, growing slowly. No
  pagination, no virtualised lists, no query tuning. Clarity over cleverness
  everywhere in this codebase.
- **Sample data must look like sample data.** Plausible in tone, obviously not
  a real finding, always behind the banner. Fictional scores attached to real
  country names, on a page that could be mistaken for actual Crisil work, is a
  reputational problem — not a cosmetic one.
- **When a doc requirement conflicts with normal practice, the doc wins.**
  Where the docs are genuinely silent, take the simpler option and leave a
  comment saying that's what happened and why.

## Standing architectural constraints (do not re-litigate)

- Editing is decoupled from publishing — no code path lets an upload reach the
  public site without an explicit human Publish confirmation.
- MongoDB is the system of record. Every publish is a complete, immutable
  snapshot with a monotonic `version`. Nothing is ever deleted; superseded
  snapshots become `archived`.
- Every uploaded workbook (accepted and rejected) is retained in Azure Blob
  Storage. Write the blob before creating any Mongo document referencing it.
- Public pages are static + cached; Mongo is never in the public request path.
  Publishing triggers `revalidateTag('index-data')` — that is the entire
  "go live" mechanism.
- Single Next.js app (App Router) — public, admin, and API routes in one repo,
  one deployment. No separate backend service, no ORM.
- The frontend is fully data-driven. No country name, pillar name, count, or
  score band threshold is ever hardcoded in a component. Adding a country is a
  spreadsheet row, never a code change — this is the constraint the whole
  project exists to protect.

## Out of scope for v1 (do not build)

Month-on-month trend charts, country comparison / side-by-side view, PDF/CSV
export, multi-language support, a public API, automated file-watching
(SharePoint/Drive), email/Teams approval workflow. Note these in the README as
future work if touched.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
