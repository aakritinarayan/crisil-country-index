# BUILD PLAN

Ordered phases. Each has an acceptance check — do not move on until it passes.

Read `CONTEXT.md`, `FLOW.md`, `DATA_MODEL.md`, and `TECH_SPEC.md` first.

---

## Phase 0 — Scaffold

- Next.js App Router project, TypeScript strict, Tailwind.
- `lib/mongo.ts` with the cached client.
- `lib/storage.ts` — Azure Blob client, with credential acquisition isolated in
  one function so Managed Identity can replace the connection string later.
- `.env.example` with every key documented.
- Folder structure per `TECH_SPEC.md` §2.
- `README.md` stub.

**Accepts when:** `npm run dev` serves a placeholder page, the app connects to
Mongo without leaking connections on hot reload, and a smoke test can write and
read back a blob in the `index-uploads` container.

---

## Phase 1 — Data layer

Build this before any UI. Everything else depends on the shapes being right.

- `lib/schema.ts` — zod schemas for all five tabs and the payload.
- `lib/parse-excel.ts` — workbook to raw rows, matching columns by header name.
- `lib/validate.ts` — every rule in `DATA_MODEL.md` §2: structural, content,
  warnings, sanitisation, diff.
- `lib/bands.ts` — parse `score_bands`, map a score to band, label, colour.
- `lib/snapshots.ts` — create draft, list, get by version, find published,
  publish with the atomic transaction, allocate version numbers.

**Accepts when:** unit tests cover every validation rule, including band
boundary values, a workbook with a missing column, a workbook with a duplicate
country-pillar pair, and a rationale containing a `<script>` tag.

---

## Phase 2 — Template and seed

- `scripts/generate-template.ts` writes `template/index-data-template.xlsx`
  with all five tabs, named Excel Tables, dropdowns, numeric validation,
  protected structure, hidden `_template_version`, and the sample data from
  `CONTEXT.md` §6.
- `template/README.md` — instructions for the client's team, including the
  warning that everything in the workbook becomes public.
- `scripts/seed.ts` parses the generated template and publishes it as version 1.

**Accepts when:** the generated file opens cleanly in Excel, its dropdowns work,
columns cannot be inserted, and running the seed script produces a published
snapshot in Mongo that passes validation.

Generating the template and then feeding it straight back through the parser is
the cheapest possible end-to-end test of the data layer. Do it in this order for
that reason.

---

## Phase 3 — Public site

- `(public)/layout.tsx` — chrome, nav, sample-data banner, footer disclaimer.
- Landing page with the score matrix, legend, and composite column.
- Score detail drawer: deep-linkable via `?country=&pillar=`, focus trapped,
  `Escape` to close, previous/next across pillars.
- Country pages with summary, radar chart, and expandable pillar blocks.
- Methodology page rendering the sanitised markdown blocks.
- Empty state for when no snapshot is published.

**Accepts when:** every value on every public page comes from the snapshot
payload; a full-text search of `components/public/` finds no country name,
pillar name, or hardcoded threshold; the matrix is usable at 320px; and pasting
a drawer URL into a fresh tab opens that drawer.

---

## Phase 4 — Auth and admin shell

- Auth.js with the Credentials provider and a commented Entra ID block.
- `middleware.ts` guarding `/admin/:path*`.
- `/login` page.
- `/admin` snapshot list with version, period, status, uploaded, by,
  validation, actions. Empty state included.

**Accepts when:** an unauthenticated request to any `/admin` route redirects to
login, the API handlers reject unauthenticated requests independently of
middleware, and the snapshot list shows the seeded version 1 as published.

---

## Phase 5 — Upload and validation

- `/api/admin/upload` — multipart, guard rails, **write to blob storage**, parse,
  validate, sanitise, save draft, return report and diff.
- `/api/admin/download/[version]` — session-checked, streams the blob or issues
  a 15-minute read-only SAS URL.
- `/admin/upload` page with the file picker.
- Validation report: errors grouped by tab with row and column, each stating
  what is wrong and what valid looks like.
- Diff view: scores as `before → after`, edited rationale as a text diff, added
  and removed references listed.

**Accepts when:** a deliberately broken workbook (missing column, out-of-range
score, duplicate pair, malformed URL, over-long rationale) produces a report
naming every problem in one pass, nothing is saved as publishable, and the
rejected file is present under `rejected/` in blob storage. An accepted workbook
lands under `snapshots/v{n}/` and downloads correctly from the snapshot list.

---

## Phase 6 — Preview and publish

- `/admin/preview/[version]` rendering any snapshot through the public
  components, with a "previewing version N, not live" banner.
- `/api/admin/publish` — atomic transaction, then `revalidateTag('index-data')`.
- Publish confirmation dialog showing the diff against what is live.
- Publishing an earlier version from the snapshot list — this is rollback, and
  it is the same code path.

**Accepts when:** publishing a new version updates the public site within
seconds without a redeploy; publishing an earlier version restores it exactly;
the previously published snapshot is `archived` rather than deleted; and exactly
one snapshot has `status: "published"` after every operation.

---

## Phase 7 — Polish and handover

- Design pass against `TECH_SPEC.md` §9.
- Lighthouse accessibility 100 on all public routes; keyboard-only pass through
  the matrix and drawer.
- Integration test: upload → validate → publish → public page reflects it.
- `README.md`: local setup, env vars, seeding, deployment, and a short
  "how the client updates data each month" section.
- `TODO(decision)` comments at every default listed in `CONTEXT.md` §5.

**Accepts when:** a developer who has never seen the repo can clone it, follow
the README, and reach a working local site with seeded data.

---

## Working notes

**Build the data layer before the UI.** The shapes in `DATA_MODEL.md` are the
contract. Getting them right first means the UI is assembly rather than
redesign.

**Treat the validation rules as the product.** The visible dashboard is
straightforward. What actually protects the client is the layer that stops a bad
number reaching a public page carrying their name. Spend the care there.

**Do not optimise prematurely.** Fifteen records. No pagination, no virtualised
lists, no query tuning. Clarity everywhere.

**Sample data must look sample.** Plausible in tone, obviously not real
findings, and always behind the banner. Fictional scores about real countries on
a page that could be mistaken for client work is a reputational problem.

**When a requirement here conflicts with something you would normally do, this
document wins.** Where it is genuinely silent, choose the simpler option and
leave a comment saying you did.
