# Country Index Dashboard

A public-facing dashboard publishing a country index (currently placeholder
data — see `docs/CONTEXT.md`). Editors upload a monthly Excel workbook through
an admin area; uploads are validated, previewed, and published as immutable,
versioned snapshots. Public pages are statically rendered from the published
snapshot and never read the database live.

Full specification: `docs/CONTEXT.md`, `docs/FLOW.md`, `docs/DATA_MODEL.md`,
`docs/TECH_SPEC.md`, `docs/BUILD_PLAN.md`. Working rules: `CLAUDE.md`.

## Status

Phases 0–6 of `docs/BUILD_PLAN.md` are complete: the full
upload → validate → diff → preview → publish → rollback loop works end to
end. Deployed at `https://crisil-proto.vercel.app` (Vercel + MongoDB Atlas +
Azure Blob Storage). Remaining from Phase 7: Lighthouse accessibility pass,
the upload→publish integration test, `TODO(decision)` comments at every
CONTEXT §5 default, and keyboard-only QA.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values — see notes in that file
npm run seed                 # publishes the sample template as version 1
npm run dev
```

Requirements for `.env.local`:

- `MONGODB_URI` must point at a **replica set** (publishing runs in a
  transaction). A single-node local replica set works; Atlas always is one.
- `AZURE_STORAGE_CONNECTION_STRING` — a real storage account or Azurite.
  The `index-uploads` container is created automatically on first upload.
- **Escape `$` as `\$` in any value** (bcrypt hashes, passwords) — Next's
  local env loader otherwise mangles them silently. Details in `.env.example`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` — generate a hash with:
  `node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"`

## Scripts

```bash
npm run dev               # dev server
npm run build             # production build (public pages prerender statically)
npm test                  # 59 unit tests (node:test); snapshots tests need MONGODB_URI
npm run generate-template # regenerate template/index-data-template.xlsx
npm run seed              # parse the template and publish it as a new version
npm run reset -- --yes    # DEV ONLY: wipe all snapshots + blobs for a clean demo
```

Note: `seed`/`reset` write directly to the database and cannot refresh the
deployed site's page cache. After running them against the production
database, open `/admin`, Preview the published version, and click Publish
once — it's a no-op in the database but triggers the cache revalidation.

## How the client updates data each month

1. Edit the maintained Excel workbook (five tabs — format documented in
   `template/README.md`; the template enforces most rules via dropdowns and
   locked structure).
2. Sign in at `/admin` and upload the file. Validation reports every problem
   in one pass, or shows a diff of exactly what changed.
3. Preview the draft — the full public site rendered from it, marked not live.
4. Publish, confirm against the diff. The public site updates within seconds.
5. Rollback = preview any earlier version and publish it. Nothing is ever
   deleted.

Demo workbooks for walking through this flow (including a broken file and an
add-a-country file) are in `demo-files/` with a suggested demo script.

## Embedding on a third-party site

Two options, both load the dashboard chromeless (no header/nav; the
sample-data banner and legal disclaimer always remain):

**Widget (recommended)** — one script, one tag, auto-resizes to content:

```html
<script src="https://crisil-proto.vercel.app/widget.js" defer></script>
<country-index-widget></country-index-widget>
<!-- optional: src, path="/country/india", width, height (fixed if set) -->
```

**Raw iframe** — point at any page with `?embed=1`; listen for
`{source:"country-index-dashboard", type:"resize", height}` postMessages to
auto-size the frame. Working examples: `widget-demo.html`, `embed-demo.html`.

## Deployment

Vercel project → set every key from `.env.example` in the environment
settings (no `\$` escaping needed there — that's a local-file quirk). Atlas
needs the Vercel integration or an IP allowlist; the Azure Storage container
is private (downloads go through short-lived SAS URLs). `SHOW_SAMPLE_DATA_BANNER`
must stay `true` until real data lands — it also controls `noindex`.

## Out of scope for v1 (future work)

Month-on-month trend charts, country comparison / side-by-side view, PDF/CSV
export, multi-language support, a public API, automated file-watching
(SharePoint/Drive), email/Teams approval workflow.
