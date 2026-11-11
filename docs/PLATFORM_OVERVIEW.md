# Country Index Dashboard — Platform Overview

Everything known about the platform so far: what it is, what it must do, how it is built, the decisions made, and where the work stands.

*Last updated: 11 November 2026*

---

## 1. What it is

A **public-facing dashboard that publishes a country index** for **Crisil**, an Indian analytics, ratings and research firm majority owned by S&P Global.

- The index scores **countries** across **pillars**. Each country–pillar pair has a **score**, a written **rationale**, and a list of **public reference links**.
- The spec was written for **3 countries × 5 pillars = 15 records**. The platform must now also work for **200+ countries** (decided 10 Nov 2026).
- The client's analysts **update the data monthly from an Excel workbook**, through an admin area, **without a developer**.
- It must stay **operational for about one year**.
- It will be **hosted on, or embedded into, a third-party website**. That party is not confirmed yet; a WordPress embed was shown to the client as optional and outside the current scope.

### Why rigour matters
- Crisil's product is credible numbers. Publishing a wrong figure, or losing the record of what was published and when, is a **serious defect**, not a rough edge.
- The site will pass through **brand and legal review** before going public.

---

## 2. Source material

| File | What it is |
|---|---|
| `docs/CONTEXT.md` | Purpose, client requirements, settled decisions, open decisions, non-negotiables, out of scope |
| `docs/FLOW.md` | Public navigation, admin flow, data pipeline, rollback, failure handling |
| `docs/DATA_MODEL.md` | Excel template, validation rules, MongoDB schema, client payload |
| `docs/TECH_SPEC.md` | Stack, repo structure, routes, auth, uploads, storage, env vars, design direction |
| `docs/BUILD_PLAN.md` | Phased build plan (Phases 0–7) with acceptance checks |
| `client-walkthrough/Public-Dashboard-Walkthrough.pdf` | 16-page client deck: the public site in 10 steps, plus an optional WordPress embed |
| `client-walkthrough/Admin-Module-Walkthrough.pdf` | 17-page client deck: the admin module in 14 steps |
| `GRA Colours and fonts gudideline.pdf` | Brand palette and fonts (see §9) |
| `02-monthly-update.xlsx` | Sample monthly workbook: 3 countries, 5 pillars, 15 scores, 30 references |
| `CLAUDE.md`, `README.md` | **Out of date.** Both describe an earlier build (Phases 0–6 complete, deployed at `crisil-proto.vercel.app`) whose code no longer exists. The project is being rebuilt from scratch. Both files need rewriting. |

---

## 3. Client requirements

1. A public, live dashboard hosted on a third-party website.
2. A landing page showing each country's scores across the pillars.
3. Clicking a country–pillar score shows its rationale and supporting reference links.
4. A dedicated page per country: summary, detailed pillar scores, rationale, references.
5. A separate methodology section: framework, scoring approach, assumptions.
6. Data updated monthly by the client's team from an Excel file, with scores, rationale and links reflected on the site.
7. Publicly accessible, with no login or password for the public dashboard.
8. Operational for about one year.

---

## 4. Users

| User | What they do |
|---|---|
| **Public visitors** | Browse scores, read rationale and sources, view country pages and methodology. No login. |
| **Analysts (admin)** | Sign in, upload the monthly workbook, review validation results and the change summary, preview, publish, roll back. |

A normal month for an analyst: upload → read the change summary → preview → publish. About **three minutes, twelve times a year**.

---

## 5. Public site

### Pages
| Route | Content |
|---|---|
| `/` | Landing: index name, "as of" date, intro, score overview, band legend, composite score |
| Score drawer | Opens from any score as a side panel; the page stays visible behind it |
| `/country/[slug]` | Country summary, composite score, radar chart (with a table alternative for screen readers), expandable pillar blocks, links to other countries |
| `/methodology` | Framework, pillar definitions, scoring scale and bands, how scores are assigned, weighting, data sources and cut-off date, assumptions and limitations, update cadence, disclaimer. All content comes from the workbook. |

### Score drawer requirements
- Country, pillar, score with band label and the scale for context, rationale, references (title, publisher, date, link).
- Previous / next across that country's pillars without closing.
- Link to the full country page.
- **Shareable link**: opening it sets `?country={id}&pillar={id}`, loading that link opens it directly, closing restores the clean URL.
- Focus trapped while open, closes on Escape, focus returns to the score that opened it.

### Rules for every public page
- **Data-driven**: no country name, pillar name, count or band threshold is ever hardcoded. Adding a country is a spreadsheet row, never a code change. This is the most important architectural constraint.
- **Score is never colour alone**: always the numeral + band colour + band label.
- **Sample-data banner** while data is placeholder: "Sample data — not a Crisil assessment", plus `robots: noindex, nofollow`. Controlled by `SHOW_SAMPLE_DATA_BANNER`.
- **Disclaimer** in the footer on every page, from `meta.disclaimer`. It must state that the index is not a credit rating.
- **No Crisil branding** in the UI until the brand kit is approved.
- **Accessibility floor**: semantic HTML, visible keyboard focus, WCAG 2.1 AA contrast, respects reduced motion, usable at 320px width, Lighthouse accessibility 100.
- **Empty state** when nothing is published: "This index has not been published yet". Never an error page or an empty grid.
- **Static and cached**: public pages never read the database live.

---

## 6. Admin module

| Route / step | What happens |
|---|---|
| `/login` | Sign in. Credentials (bcrypt password) for now; Microsoft Entra ID SSO later as a config change only. JWT sessions, 8-hour expiry. |
| `/admin` | Version list, newest first: version, period (`as_of`), status (`published` / `draft` / `archived`), uploaded (time + filename), by, validation result, actions (Preview, Publish, Download source file). Exactly one version is published at any time. Empty state: "No data uploaded yet. Upload the first monthly file to get started." |
| `/admin/upload` | Choose an `.xlsx`. The file is stored in Azure Blob first, then parsed and validated. |
| Validation fails | Every error listed in one pass, each naming the sheet, row and column, what is wrong and what valid looks like. Nothing saved as publishable. Live site untouched. Rejected file kept for 30 days. |
| Validation passes | Saved as a **draft**. Shows warnings and a **change summary against what is live**, e.g. "3 scores changed · 2 rationales edited · 1 source added · 1 dead link". Scores as before → after; rationale edits as a word-level diff. |
| `/admin/preview/[version]` | The full public site rendered from any version through the same public components, with a "Previewing version N — not live" banner. Never cached. |
| Publish | Confirmation step showing the change summary. Atomically archives the current version, publishes the chosen one, then refreshes the public pages. Live within seconds. |
| Rollback | Publish an earlier version. Same flow, same confirmation, itself reversible. Nothing is ever deleted. |

**Preview** is safe and used freely; **Publish** changes what the world sees and always asks for confirmation. The two are styled differently.

---

## 7. Data

### Excel workbook (five tabs, columns matched by header name, never position)

| Tab | Columns |
|---|---|
| `meta` | key / value: `index_name`, `as_of` (YYYY-MM), `intro`, `score_min`, `score_max`, `score_bands` (e.g. `0-39:Limited;40-59:Developing;60-74:Established;75-89:Advanced;90-100:Leading`), `show_composite`, `methodology_framework`, `methodology_scoring`, `methodology_sources`, `methodology_assumptions` (Markdown), `disclaimer`, hidden `_template_version` |
| `countries` | `country_id`, `name`, `iso_code` (ISO 3166-1 alpha-3), `slug`, `display_order`, `composite_score` (optional), `summary` |
| `pillars` | `pillar_id`, `name`, `description`, `display_order`, `weight` (optional) |
| `scores` | `country_id`, `pillar_id`, `score`, `rationale` (one row per country–pillar pair) |
| `references` | `country_id`, `pillar_id`, `title`, `publisher`, `url` (https only), `published_date` (optional) |

Template hardening: named Excel tables (`tbl_meta`, …), dropdowns for IDs, numeric validation on scores, protected structure, hidden template version, no merged cells, no colour carrying meaning. A `template/README.md` warns that **everything in the workbook becomes public**.

### Validation (run in order)
- **Structural errors (stop the run):** all tabs present; required columns present; template version recognised; no duplicate country or pillar IDs; exactly one score per country–pillar pair (missing pairs named); every ID resolves.
- **Content errors (all collected):** score numeric and in range; rationale non-empty and ≤ 1,200 characters; summary non-empty; `as_of` is `YYYY-MM` and not in the future; slug URL-safe and unique; bands parse and cover the full range with no gaps or overlaps; every URL well-formed and `https://`.
- **Warnings (never block):** reference URL does not return 200 (HEAD request, 5s timeout, concurrency 5); rationale under 100 characters; no references for a pair; composite inconsistent with pillar scores and weights.
- **Sanitisation on the way in, always:** strip all HTML, normalise smart quotes, non-breaking spaces and Excel encoding artefacts, trim whitespace. Store the sanitised text. Never `dangerouslySetInnerHTML` on workbook text. Methodology Markdown renders through `rehype-sanitize` (headings, paragraphs, lists, links, emphasis only).

### MongoDB
- One collection, `snapshots`. **One complete document per version**, holding the whole dataset.
- Fields: `version` (monotonic, atomic increment, never reused), `as_of`, `status`, `created_at` / `created_by`, `published_at` / `published_by`, `source_file` (filename, size, SHA-256 checksum, container, blob path, uploaded_at), `validation` (passed, errors, warnings), `diff_from_published`, `payload`.
- `version` and `as_of` stay separate, so a correction to September is version 8 but still `as_of: 2026-09`.
- Indexes: `{version: -1}` unique, `{status: 1, version: -1}`, `{as_of: 1, version: -1}`.
- Invariants: nothing deleted; exactly one `published` (enforced in a transaction); every snapshot points at a blob that exists.

### Azure Blob Storage
- Private container `index-uploads`. Accepted files at `snapshots/v{version}/{filename}` (kept indefinitely); rejected files at `rejected/{uuid}/{filename}` (deleted after 30 days by a lifecycle rule).
- The file is written **before** any Mongo document references it.
- Downloads go through a session-checked route that streams the file or issues a 15-minute read-only SAS URL.
- Recommended account settings: blob versioning, 30-day soft delete, a time-based immutability policy on `snapshots/`, ZRS redundancy, and a region confirmed for data residency (possibly India).

### Payload served to the browser
`meta` (with bands parsed into `{min, max, label}`), `countries`, `pillars`, and `scores` with references nested inside each score. Band colours are derived at render time, never stored in the spreadsheet.

---

## 8. Technology

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind CSS 4, all colour and type as tokens in one file |
| Database | MongoDB Atlas via the official `mongodb` driver (no ORM); all DB access in `lib/snapshots.ts` |
| File storage | Azure Blob Storage via `@azure/storage-blob`; credential acquisition in one function so Managed Identity can replace the connection string |
| Auth | Auth.js v5 |
| Excel | `exceljs` (reads uploads and writes the template) |
| Validation | `zod` |
| Charts | `recharts` (radar chart) |
| Markdown | `react-markdown` + `rehype-sanitize` |
| Map (added) | `d3-geo`, `topojson-client`, `world-atlas` (approved 10 Nov 2026) |
| Hosting | Vercel + MongoDB Atlas; keep `output: 'standalone'` viable for self-hosting |

### Architecture rules
- **Editing is decoupled from publishing**: no upload reaches the public site without a person confirming Publish.
- **Single Next.js app**: public, admin and API routes in one repo and one deployment.
- **Public pages are static and cached**. Publishing calls `revalidateTag('index-data')`; that is the whole "go live" mechanism.
- Admin routes are never cached. API handlers check the session themselves; middleware only handles redirects.
- Uploads: `.xlsx` only, 4 MB limit (Vercel's body limit is about 4.5 MB), corrupt files get a clear message, and an unchanged file (same checksum) gets a warning.

### Environment variables
`MONGODB_URI`, `MONGODB_DB`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER=index-uploads`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `NEXT_PUBLIC_SITE_URL`, `SHOW_SAMPLE_DATA_BANNER=true`. Design phase also uses `DATASET` (`workbook` = real 3-country file; anything else = 196-country sample).

---

## 9. Design direction (decided 10 Nov 2026)

| Decision | Choice |
|---|---|
| Style | Follows the **InovaFint** website (`~/Documents/InovaFint-Website-Handoff`): large tightly spaced headlines with the last words in a gradient, pill-shaped section labels, square corners, hairline borders, soft shadows, buttons with a square arrow box, a map hero with "Find a country" search and filters |
| Colours | **GRA guideline**: primary lime `#95C11F`, teal `#00AAA6`, charcoal `#353535`; secondary blue `#0069B3`, orange `#FF6300`, green `#18AD2B`, sky `#00BCF3`, yellow `#F2C900` |
| Font | **Open Sans** (the GRA guideline names Futura PT; the user chose Open Sans) |
| Themes | **Light and dark**, with a switch in the header; follows the visitor's system setting until they choose |
| Map | **One continuous geographic experience** (changed 11 Nov 2026 at the user's request): the dark hero shows a photographic half-globe (WebGL shader over a Solar System Scope CC BY 4.0 texture, credited in the hero; no 3D library) that, on lg screens, travels on scroll into the light Country Explorer and becomes its interactive globe (d3-geo orthographic SVG). The explorer has a **Globe / Flat map** switch; both views share selection, measure and band filter. No pinning, no scroll-jacking, no smooth-scroll library, no autoplay rotation |
| Motion | The drawer slide-in; globe turn / map zoom to a selected country; the scroll-linked hero → explorer globe hand-off (deviates from TECH_SPEC §10 "nothing ambient" — user-requested; it moves only with the visitor's scroll); hero stars that respond to the pointer only; hover and focus states. Reduced motion: the hand-off jumps between states, stars do not shift |
| Rejected | Two earlier directions ("Clear" light editorial and "Bold" charcoal heat map, in `design/directions/`) |

### Score-band colours
A sequential ramp built from the GRA palette, getting darker at each step so the order reads without relying on hue. It is not red-to-green.

| Band (sample workbook) | Fill | Text |
|---|---|---|
| Limited (0–39) | `#E3EADC` | dark |
| Developing (40–59) | `#BCD39B` | dark |
| Established (60–74) | `#95C11F` | dark |
| Advanced (75–89) | `#2F7F78` | white |
| Leading (90–100) | `#174A4B` | white |

Thresholds and labels always come from the workbook. If the number of bands changes, the colours are spread across the ramp automatically.

---

## 10. Designing for 200+ countries

| Area | Design |
|---|---|
| Landing | Dark hero (headline, CTAs, three live metrics, half-globe) handing off to the Country Explorer: search, Globe / Flat map switch, "Colour map by", viewer left, country panel right |
| Finding a country | Search on the map, in the header (press `/` or Ctrl/⌘ K), and in the rankings |
| Score overview | Rankings (`Rankings.tsx`): Ranked / A–Z, search by name or ISO code, band filter and "Rank by" on the explorer's active measure (shared with the map), sortable column headers (asc/desc). Competition ranks (1, 1, 3) over the full dataset, ties alphabetical, missing scores unranked and last ("Not available"). A–Z has letter groups and a jump row (renders more rows when needed). Score cells: numeral + band label + 3px band edge; every pillar score opens the rationale drawer; country names open the profile; a row action locates the country on the map. 25 rows at a time (more / all / fewer); the section's state and scroll survive a trip to a profile and back. Phones get a country list with expandable pillars |
| Map colours | Visualisation-only tokens in `globals.css` (light / dark): ocean centre `#EAF3F1` → edge `#BFCFCD`, assessed land `#F8FAF6`, unassessed `#D9E2DF`, borders `#96B0AA`, coasts `#718F89`, hover `#C9E9E3` / `#00AAA6`, selected fill (Overview) `#D8EEE8`, selected outline `#245F5C` + white inner line, teal halo at ≤10%. Depth comes from the sea gradient, a soft grounding shadow and the halo only — nothing is laid over the land, so band colours read true. The flat map uses one flat sea tone |
| Map navigation | Viewer ~70% / country panel ~30%, 520–750px tall on desktop. Globe 1–6×, flat map 1–12×: drag, wheel, trackpad and touch pinch, double-click (all zoom around the pointer), arrow keys and +/−. One control group: zoom, fit to selected country, reset, expand (full-screen workspace; Close or Escape). A plain mouse wheel zooms only after the visitor clicks into the map (or when expanded); otherwise the page scrolls and a hint shows Ctrl/⌘ + scroll — so the large map never traps page scrolling |
| Score distribution | "Where countries stand" after the rankings (`ScoreDistribution.tsx`, counting in `lib/distribution.ts`). Tabs: Global overview (default) — an aligned 100% bar per assessment (composite when enabled + every pillar), each counted independently, one country one score, missing scores outside the denominator and reported per row; shared legend highlights (hover/focus) or locks (click) a band across rows; one deterministic insight sentence (largest leader-vs-runner-up gap among top band / bottom band / top-two share, ≥2 points, else a neutral line). Assessment tabs — a large bar with a per-band breakdown. Selecting never navigates; "View countries" sets rank-by + band filter (shared state) and scrolls to the rankings. A screen-reader table carries every count and share |
| Small states | Countries too small for the map shapes (Singapore, Bahrain, Maldives, Pacific islands) are drawn as markers on the globe and dots on the flat map; search and the rankings list are the accessible route |
| Phones | Map plus a ranked list; tap a country to expand its pillars |
| Country page | Rank ("#12 of 196") instead of "links to the other two countries" (still to build) |
| Page weight | The landing page ships scores only; rationale and references load per country when a score is opened |

### Technical issues at this scale (not yet solved)
- **Link checking**: about 2,000 reference URLs at 5 at a time with a 5-second timeout could take minutes, longer than a Vercel function can run. Link checks will need to run in the background after upload.
- **Admin change summary**: one upload could change 1,000 scores. It needs grouping, filtering and the largest movements first.
- **Regions**: filtering by region would need a new `region` column in the `countries` tab. Not decided.
- **Label density**: the rule "numeral + colour + label on every score" makes 1,000 table cells heavy. The table currently uses a colour dot, the numeral and a small label.

---

## 11. Current state of the build

### Done (design build, Day 1, committed `5c0f446`)
- New project in `~/Documents/Crisil`: Next.js 16.4.6, React 19.3, Tailwind 4.3, git initialised. `cacheComponents` is on.
- **Design tokens** for light and dark (`app/globals.css`), Open Sans, InovaFint-style type scale, buttons, pill labels, score chips.
- **Public layout**: sample-data banner, sticky header (logo, nav, country search, theme switch), disclaimer footer, skip link.
- **Landing page**: hero, at-a-glance stats with band distribution, world map section, rankings, methodology prompt.
- **World map**: colour by composite or any pillar, hover tooltip, click or search to select (zooms to the country), info panel with pillar breakdown, zoom buttons, drag, double-click zoom, band filter chips with counts, "highest" list when nothing is selected.
- **Rankings**: filter, band filter, sortable columns, sticky header, "Show all", phone list.
- **Score drawer**: native modal dialog (focus trap, Escape), score and band, scale position, rationale, sources, previous/next, link to profile, shareable link, full screen on phones.
- **"Not published yet"** empty state.
- **Data**: `data/sample-workbook.json` (the real 3-country workbook) and `data/sample-global.json` (196 generated countries, clearly placeholder), ISO code lookup, small-state positions.
- **Browser check script** (`scripts/check/cdp.mjs`): drives headless Chrome, runs steps, saves screenshots, reports console errors. Verified desktop, phone, light and dark with no console errors.

### Key files
```
app/layout.tsx                      root: Open Sans, theme pre-paint script, noindex
app/globals.css                     all design tokens (GRA, light + dark)
app/(public)/layout.tsx             banner, header, footer
app/(public)/page.tsx               landing page
app/data/country/[slug]/route.ts    per-country rationale + references (static)
components/public/explorer/         ExploreWorkspace (explorer, expanded mode, hero hand-off), Globe, WorldMap, MapControls, CountryPanel, CountryShape, PillarSelector, Rankings, ScoreDistribution, ScoreDrawer, ExplorerContext
components/public/hero/             Hero, HeroMetrics, HeroActions (CTAs, phone half-globe), HeroStars, EarthCanvas (WebGL photo layer)
public/globe/                       earth-day-2k.webp, earth-clouds-2k.webp (Solar System Scope, CC BY 4.0)
components/public/                  ScoreChip, CountryCombobox, HeaderSearch, ThemeToggle, NotPublished
components/ui/icons.tsx             inline icon set
lib/types.ts                        payload types (DATA_MODEL §4)
lib/bands.ts                        score → band, colour ramp, formatting
lib/data.ts                         getPublishedSnapshot() (sample JSON now, MongoDB later), summarise()
data/                               sample datasets, ISO lookup, small-state positions
scripts/                            build-sample-data.mjs, build-small-states.mjs, check/cdp.mjs
design/directions/                  the two rejected early directions
```

### Running it
```bash
cd ~/Documents/Crisil
npm run dev -- -p 3100              # 196-country sample (ports 3000/3001 are used by InovaFint)
DATASET=workbook npm run dev -- -p 3100   # the real 3-country workbook
```

### Still to do (3-day design build)
- Country page (radar chart, expandable pillars, rank, nearby countries)
- Methodology page
- 404 page
- Login (error, loading, session-expired states)
- Admin: layout, version list, upload, validation report, change summary, preview mode, publish and rollback confirmations, system messages, phone layouts
- Accessibility pass, polish, walkthrough
- Rewrite `CLAUDE.md` and `README.md` for the rebuild

### After design (development)
Real data layer (MongoDB, Azure Blob, exceljs parsing, zod validation, sanitisation, diff), Auth.js, upload/publish/rollback APIs, template generation and seed script, tests (validation and bands unit tests, one upload → publish integration test), deployment to Vercel.

---

## 12. Open decisions

| Question | Default / status |
|---|---|
| Score format | Numeric 0–100, five bands, from the workbook |
| Sub-indicators under pillars | Schema allows them; not shown in v1 |
| Historical trend view | Not in v1 (snapshots already carry `as_of`) |
| Admin auth | Credentials + bcrypt now; Entra ID SSO for production |
| Hosting | Vercel + Atlas; host site not confirmed |
| Country comparison | Not in v1 |
| Does the GRA guideline apply to this dashboard? | Assumed yes; awaiting confirmation |
| Index name | The sample workbook's `index_name` is `"CRISIL "`, which conflicts with the no-Crisil-branding rule. Design uses "Digital Infrastructure Readiness Index". Needs a decision. |
| Real number of countries | Designing for 200+; actual list not known |
| Region filter | Needs a `region` workbook column; not decided |
| Brand kit | Not received; all styling is tokenised so it can be applied in one file |
| Legal disclaimer wording | Client to supply; must say the index is not a credit rating |
| Storage region | Confirm data-residency needs before creating the Azure account |

---

## 13. Out of scope for v1

Month-on-month trend charts, country comparison view, PDF or CSV export, multiple languages, a public API, automated SharePoint or Google Drive file watching, email or Teams approval workflow. The WordPress embed (`widget.js` / iframe) was shown to the client as optional and outside the current scope.

---

## 14. Schedule and estimates

| Item | Status |
|---|---|
| Full design estimate (Figma-based) | About 305 hours |
| 5-day coded-prototype estimate (45 hours at 9 hours a day) | Shared as a doc: https://claude.ai/artifact/FL7cvzNLbr3RXvLEEWUKYk |
| Current plan | **3 days**, best effort, design built directly in code |

---

## 15. Working rules (from the docs and the user)

- The docs win over defaults. Deviations need asking first, with the reason.
- Ask before adding any dependency not named in TECH_SPEC §1.
- Verify UI in a real browser at desktop and phone sizes, not by reading code.
- Interface copy: plain, active, sentence case. An action keeps its name through the flow ("Publish" → "Published"). Errors say what happened and what to do, and never apologise. Empty states tell the admin what to do next.
- Sample data must look like sample data and always sit behind the banner.
- Where the docs are silent, take the simpler option and leave a comment saying so.
