# TECH SPEC

Stack, structure, routes, and the decisions that are easy to get subtly wrong.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js, App Router, TypeScript, strict mode |
| Styling | Tailwind CSS |
| Database | MongoDB via the official `mongodb` driver |
| File storage | Azure Blob Storage via `@azure/storage-blob` |
| Auth | Auth.js v5 |
| Excel parsing | `exceljs` |
| Validation | `zod` |
| Charts | `recharts` for the radar chart |
| Markdown | `react-markdown` with `rehype-sanitize` |
| Hosting | Vercel + MongoDB Atlas |

Use current stable versions at build time rather than pinning to anything named
here.

**On Excel parsing:** SheetJS moved its distribution off npm to its own CDN, so
the `xlsx` package on npm may be stale. `exceljs` avoids the ambiguity and also
writes workbooks, which is needed for generating the template. Use it for both.

**No ORM.** The data model is one collection with one document shape. An ODM
adds indirection with nothing to show for it.

---

## 2. Repository structure

```
app/
  (public)/
    layout.tsx                  public chrome, banner, footer, disclaimer
    page.tsx                    landing — score matrix
    country/[slug]/page.tsx     country page
    methodology/page.tsx
  admin/
    layout.tsx                  auth guard + admin chrome
    page.tsx                    snapshot list
    upload/page.tsx             upload + validation report
    preview/[version]/page.tsx  draft preview
  login/page.tsx
  api/
    auth/[...nextauth]/route.ts
    admin/upload/route.ts
    admin/publish/route.ts
components/
  public/    ScoreMatrix, ScoreDrawer, PillarCard, RadarChart, Legend, Banner
  admin/     SnapshotTable, UploadForm, ValidationReport, DiffView, PublishDialog
  ui/        shared primitives
lib/
  mongo.ts          cached client
  storage.ts        all Azure Blob access — upload, download, SAS
  snapshots.ts      all DB access — nothing else touches the driver
  schema.ts         zod schemas
  parse-excel.ts    workbook -> raw rows
  validate.ts       rules, sanitisation, diff
  bands.ts          score -> band, colour, label
  auth.ts           Auth.js config
scripts/
  generate-template.ts   writes template/index-data-template.xlsx
  seed.ts                parses the template, publishes it as version 1
template/
  index-data-template.xlsx
  README.md              instructions for the client's team
middleware.ts
docs/                    these five markdown files
```

**All database access goes through `lib/snapshots.ts`.** Route handlers and
pages call functions from it and never import the driver directly.

---

## 3. Routes

### Public

| Route | Rendering | Notes |
|---|---|---|
| `/` | Static, cached, tag `index-data` | Score matrix. Drawer state in the query string |
| `/country/[slug]` | Static, `generateStaticParams` from the published snapshot | |
| `/methodology` | Static, cached, tag `index-data` | |

All three read via a single cached accessor:

```ts
export const getPublishedSnapshot = unstable_cache(
  async () => snapshots.findPublished(),
  ['published-snapshot'],
  { tags: ['index-data'] }
)
```

Publishing calls `revalidateTag('index-data')`. That is the entire
"trigger render" mechanism — no build hooks, no CDN purge.

### Admin

All under `/admin`, all `export const dynamic = 'force-dynamic'` so nothing is
ever cached and no draft can leak into a cached response.

| Route | Purpose |
|---|---|
| `/admin` | Snapshot list |
| `/admin/upload` | Upload, validation report, diff |
| `/admin/preview/[version]` | Any snapshot rendered through the public components |
| `/login` | Sign in |

`/admin/preview/[version]` should reuse the public page components with the
snapshot passed as a prop. Do not fork the rendering code — a preview that
renders differently from production is worse than no preview.

### API

| Route | Method | Behaviour |
|---|---|---|
| `/api/admin/upload` | POST | multipart. Parse, validate, sanitise, save draft, return report + diff |
| `/api/admin/publish` | POST | `{ version }`. Set pointer, revalidate, return new state |
| `/api/admin/download/[version]` | GET | Session-checked. Streams the stored workbook, or redirects to a short-lived SAS URL |

Both check the session server-side. Never rely on middleware alone for
authorisation — middleware handles redirects, the handler handles the actual
check.

---

## 4. Auth

Auth.js v5, Credentials provider, bcrypt-hashed password from
`ADMIN_PASSWORD_HASH`. JWT sessions, 8-hour expiry.

`middleware.ts` matches `/admin/:path*` and redirects unauthenticated requests
to `/login` with a `callbackUrl`.

Write the provider configuration so swapping to **Microsoft Entra ID SSO** is a
config change in `lib/auth.ts` and nothing else. That is the production path —
Crisil is a Microsoft environment, SSO means no password for anyone to store or
rotate, and access follows their existing joiner/leaver process. Leave a
commented Entra provider block in place with the env vars it needs.

Whichever provider is active, the session must yield an identifying string that
gets written to `created_by` and `published_by`.

---

## 5. Upload handling

```ts
const form = await request.formData()
const file = form.get('file') as File
```

Guard rails, each with its own clear error message:

- Reject anything that is not `.xlsx` before parsing.
- Reject over 4MB. Vercel serverless functions cap request bodies around 4.5MB;
  these workbooks will be far smaller, but an embedded image would push one over
  and produce a confusing 500 instead of a useful message.
- Wrap parsing in try/catch — a corrupt workbook must produce "This file could
  not be read as an Excel workbook", not a stack trace.
- Compute a SHA-256 checksum. If it matches the published snapshot's checksum,
  warn that the file appears unchanged.

**Write the file to blob storage before creating the snapshot document**, so a
snapshot can never reference a blob that does not exist. Store the file whether
validation passes or fails — a rejected workbook is the single most useful thing
to have when the client asks why their upload was refused. See §7.

---

## 6. Mongo connection

Serverless invocations reuse the process. Cache the client promise on
`globalThis` or connections leak until Atlas refuses new ones:

```ts
const g = globalThis as { _mongo?: Promise<MongoClient> }
export const clientPromise = g._mongo ??= new MongoClient(uri).connect()
```

Vercel's egress IPs are dynamic, so Atlas needs either the Vercel integration or
a `0.0.0.0/0` network allowlist. If it is the latter, the connection string is
the only thing protecting the database: use a strong generated password, a user
scoped to this database alone, and rotate at handover.

### Publish transaction

Publishing touches three things and must be atomic:

1. Current published snapshot → `archived`
2. Target snapshot → `published`, set `published_at` / `published_by`
3. `revalidateTag('index-data')` **after** the write commits

Use a transaction or a guarded conditional update. Two admins clicking Publish
simultaneously must not produce two published snapshots.

---

## 7. File storage — Azure Blob Storage

Every uploaded workbook is retained. Mongo holds the parsed snapshot; blob
storage holds the file it came from.

### Container layout

One **private** container, `index-uploads`:

```
snapshots/v{version}/{original-filename}   accepted — retained indefinitely
rejected/{uuid}/{original-filename}        failed validation — expires after 30 days
```

A rejected upload has no version number yet, hence the UUID prefix. Apply an
Azure lifecycle management rule to delete the `rejected/` prefix after 30 days
so it does not accumulate.

### Access

**The container is private. No anonymous access, no public container.** The
accepted data becomes public through the site, but drafts and rejected files do
not, and a public container is a standing invitation to find them.

Admin downloads go through `/api/admin/download/[version]`, which checks the
session and then either streams the blob or issues a **short-lived SAS URL** —
15 minutes, read-only, scoped to that single blob. Never embed a long-lived SAS
token in a page or a link.

### Authentication

`AZURE_STORAGE_CONNECTION_STRING` in the environment.

Write `lib/storage.ts` so that credential acquisition is one function. If the
app later moves onto Azure infrastructure, that function switches to
`DefaultAzureCredential` with a Managed Identity and the connection string is
deleted. Nothing else in the codebase should change.

### Storage account settings

Raise these with whoever provisions the account:

- **Blob versioning** and **soft delete** (30 days) enabled.
- A **time-based immutability policy** on the `snapshots/` prefix. For a ratings
  firm, "the published file cannot be altered after the fact" is a meaningful
  property and is worth asking for explicitly.
- **Region.** Confirm data-residency requirements before creating the account.
  An Indian region may be required, and moving a storage account later means
  recreating it.
- **Redundancy.** At a few megabytes a year the tier is a rounding error. ZRS.

### On running Vercel against Azure storage

Perfectly fine. Blob access only ever happens on the admin path — upload and
download — never in a public page render, so cross-cloud latency is invisible to
visitors. If the client later requires everything in Azure, `output: 'standalone'`
keeps that door open.

---

## 8. Environment variables

```
MONGODB_URI=
MONGODB_DB=
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=index-uploads
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
NEXT_PUBLIC_SITE_URL=
SHOW_SAMPLE_DATA_BANNER=true
```

Ship `.env.example` with every key and a comment. Never commit `.env.local`.

---

## 9. Public site requirements

**Fully data-driven.** No country name, pillar name, count, or band threshold
appears in any component. Everything derives from the payload. Adding a fourth
country is a spreadsheet row.

**Never trust workbook text.** All text is sanitised on ingest. No
`dangerouslySetInnerHTML` on any field originating from the file. Markdown
fields render through `rehype-sanitize` with a restrictive allow-list.

**Score is never colour alone.** Every cell shows the numeral and the band
label alongside the band colour. Required for accessibility and for anyone
printing the page.

**Responsive.** The matrix becomes one card per country below the `md`
breakpoint. Test at 320px.

**No published snapshot** → a neutral empty state on every public route. Never
an error page, never an empty grid.

**When `SHOW_SAMPLE_DATA_BANNER` is true**, render the sample-data banner
site-wide and emit `robots: noindex, nofollow`.

---

## 10. Design direction

The brand kit has not arrived, so do not invent a brand. But do not ship the
default template look either.

- Neutral, restrained palette. Reserve saturation entirely for the score bands
  — they are the only thing on the page that should carry colour meaning.
- Choose a band ramp that is sequential, colour-blind safe, and passes AA
  contrast against its own text at every step. Do not use red-to-green.
- Pair a characterful display face with a highly legible body face, and use a
  tabular-figure font for the scores so the matrix aligns down its columns. This
  is a data instrument — the numerals are the typography that matters.
- Let the matrix itself be the signature element of the landing page. It is the
  whole product. Give it room, get its alignment and rhythm exact, and keep
  everything around it quiet.
- Motion: only the drawer transition and focus states. Nothing ambient.

Keep all colour and type decisions in Tailwind theme tokens so a brand kit can
be applied in one file.

---

## 11. Quality floor

- TypeScript strict, no `any` in application code.
- Unit tests for `validate.ts` and `bands.ts` — the validation rules are the
  part that actually protects the client, and the band logic is the part most
  likely to be quietly wrong at boundaries.
- One integration test for the full upload → validate → publish → read path.
- Lighthouse accessibility 100 on the public routes.
- `README.md` covering local setup, env vars, seeding, and how the client
  updates data.
