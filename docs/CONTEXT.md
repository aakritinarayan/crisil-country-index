# CONTEXT

Read this first. It explains what is being built and why. Then read `FLOW.md`,
`DATA_MODEL.md`, `TECH_SPEC.md`, and `BUILD_PLAN.md` in that order.

---

## 1. What this is

A public-facing dashboard that publishes a country index. The index assesses
**3 countries** across **5 pillars**. Each country-pillar pair carries a score, a
written rationale, and a list of public reference links.

That is 15 records. Everything the site does is a different view of those 15
records, plus a static methodology section.

The client's team updates the underlying data monthly via an Excel file. Those
updates must reach the live site without a developer being involved.

## 2. Who it is for

The end client is **Crisil** — an Indian analytics, ratings and research firm,
majority owned by S&P Global. Two consequences that shape the build:

- **Rigour is expected.** This is a firm whose product is credible numbers.
  Anything that could publish a wrong figure, or lose the record of what was
  published when, is a serious defect rather than a rough edge.
- **Compliance review is real.** The site will pass through brand and legal
  review before going public. Build the disclaimer and attribution slots into
  the layout from the start rather than retrofitting them.

The dashboard will be hosted on or embedded into a third-party website. That
party is not yet confirmed. Build standalone; embedding is handled separately.

## 3. Client requirements, verbatim in substance

1. Public-facing live dashboard, hosted on a third-party website.
2. Landing page showing country-level scores across the five pillars.
3. Click a country-pillar score to see the rationale and supporting reference
   links.
4. A dedicated page per country: country summary, detailed pillar scores,
   rationale, references.
5. A separate methodology section: framework, scoring approach, assumptions.
6. Backend data updated monthly by the client's team, from an Excel file, with
   updates reflected on the front end — scores, rationale text, and links.
7. Publicly accessible. No login, no password for the public dashboard.
8. Must remain operational for approximately one year.

## 4. Decisions already made

These are settled. Do not re-litigate them while building.

**Editing is decoupled from publishing.** The public site never reads the Excel
file or the database live. An upload is parsed, validated, stored as a draft,
previewed, and only then published. A typo must not be able to reach the public
site without a human confirming it.

**MongoDB is the system of record.** Every publish is stored as a complete,
immutable snapshot document with a monotonic version number. Nothing is ever
deleted or overwritten — superseded snapshots are marked archived. This gives
rollback, an audit trail, and the month-by-month history needed for trend charts
later.

**Uploaded workbooks are retained in Azure Blob Storage.** Mongo holds the
parsed snapshot; blob storage holds the artefact it was parsed from. Every
upload is kept — accepted and rejected alike. Being able to produce the exact
file behind a published figure is an audit requirement for this client, not a
convenience.

**Public pages are statically rendered and cached.** Mongo is not in the
request path for public visitors. Publishing calls Next.js on-demand
revalidation, which regenerates the affected pages. Visitors get static HTML
from the edge; the database is only read during revalidation.

**Single Next.js application.** App Router. Public pages, admin area, and API
routes all live in one repo and one deployment. No separate backend service.

**The frontend is fully data-driven.** No country name, pillar name, count, or
score band is hardcoded anywhere in the code. Everything renders from the
snapshot payload. Adding a fourth country must be a spreadsheet row, never a
code change. This is the single most important architectural constraint in the
project — the site has to survive twelve months of edits by non-developers.

## 5. Open decisions and the defaults to build against

The client has not answered these yet. Build the default, isolate it so it is
cheap to change, and leave a `TODO(decision)` comment at each site.

| Question | Default to build | Where it must be easy to change |
|---|---|---|
| Score format | Numeric `0-100`, five colour bands | `scoreBands` config, driven by the `meta` tab |
| Sub-indicators beneath pillars | Schema supports them, UI does not show them in v1 | Optional `indicators` array on each score |
| Historical trend view | Not built in v1 | Snapshots already carry `as_of`, so it is additive |
| Admin auth | Credentials provider, bcrypt-hashed password | Auth.js config — swap to Entra ID SSO for production |
| Hosting | Vercel + MongoDB Atlas | Keep `output: 'standalone'` viable for self-hosting |
| Country comparison view | Not built in v1 | — |

## 6. Sample data for the prototype

The real index subject and country list are not yet known. Generate placeholder
data so the prototype is demonstrable:

- **Index name:** "Digital Infrastructure Readiness Index"
- **Countries:** India, Indonesia, Vietnam
- **Pillars:** Infrastructure; Regulatory environment; Skills and talent;
  Investment and finance; Adoption and usage
- **Rationale text:** two to four sentences per score, plausible in tone but
  obviously generic. Do not fabricate statistics that read as real findings.
- **References:** two to four per score, pointing at genuinely public sources
  (World Bank, ITU, OECD, national regulators). Real URLs so the dead-link
  checker has something to work against.

All of this comes from the Excel file and the `meta` tab. None of it is
hardcoded.

## 7. Non-negotiables

**Sanitise all text before rendering.** Rationale and summary text travels from
a spreadsheet to a public page. Escape or strip HTML on the way in. Never
`dangerouslySetInnerHTML` on any field originating from the workbook. This is
the standard defacement path for this class of site.

**Sample-data banner.** While the data is placeholder, the site displays a
persistent, unmissable banner: `Sample data — not a Crisil assessment`. Also set
`robots: noindex, nofollow` until real data lands. Fictional scores about real
countries on a page that could be mistaken for client work is a reputational
problem, not a cosmetic one.

**No Crisil branding yet.** No logo, no brand colours, no company name in the
UI chrome until the brand kit arrives. Use neutral styling.

**Disclaimer slot.** Reserve a footer block, populated from the `meta` tab, for
legal text. The client will supply wording, and it will need to state explicitly
that the index is not a credit rating.

**Every published snapshot records who published it and when.** An audit trail
that cannot name a person is not an audit trail.

**Accessibility floor:** semantic HTML, visible keyboard focus, WCAG 2.1 AA
colour contrast, works with reduced motion, usable at 320px width. Score must
never be communicated by colour alone — always pair the band colour with the
numeral and a text label.

## 8. Out of scope for v1

Do not build these. Note them in the README as future work.

- Month-on-month trend charts
- Country comparison / side-by-side view
- PDF or CSV export
- Multi-language support
- Public API for third-party consumers
- Automated SharePoint or Google Drive file watching — v1 is manual upload
  through the admin page
- Email or Teams approval workflow

## 9. Tone for interface copy

Plain, active, sentence case. An action keeps its name through the whole flow —
the button says "Publish", the confirmation says "Published". Errors state what
happened and what to do about it, and never apologise. Empty states tell the
admin what to do next.

Write from the user's side of the screen: "Upload the monthly file", not
"Ingest workbook".
