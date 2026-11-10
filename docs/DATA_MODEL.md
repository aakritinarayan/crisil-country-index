# DATA MODEL

The Excel template, the validation rules, and the shapes the data takes in
Mongo and on the wire.

---

## 1. Excel template

Generate this as part of the build: `template/index-data-template.xlsx`, filled
with the sample data from `CONTEXT.md` §6. It doubles as the sample workbook for
the demo and the template handed to the client.

Five tabs. **Columns are matched by header name, never by position.** Header
names are case-insensitive and trimmed.

### Tab: `meta`

Two columns, `key` and `value`. Free-form key-value store for everything that
is site content rather than score data.

| key | Example value |
|---|---|
| `index_name` | Digital Infrastructure Readiness Index |
| `as_of` | 2026-09 |
| `intro` | Two or three sentences shown under the landing page header. |
| `score_min` | 0 |
| `score_max` | 100 |
| `score_bands` | `0-39:Limited;40-59:Developing;60-74:Established;75-89:Advanced;90-100:Leading` |
| `show_composite` | TRUE |
| `methodology_framework` | Long-form markdown. |
| `methodology_scoring` | Long-form markdown. |
| `methodology_sources` | Long-form markdown. |
| `methodology_assumptions` | Long-form markdown. |
| `disclaimer` | Footer legal text. |

`score_bands` drives the colour scale, the legend, and the band labels. Nothing
about the scale is hardcoded — changing the scale to 1-5 must be a spreadsheet
edit.

The `methodology_*` values accept markdown. Render with a sanitising markdown
parser that permits only headings, paragraphs, lists, links, emphasis. No raw
HTML.

### Tab: `countries`

| Column | Type | Notes |
|---|---|---|
| `country_id` | text | Stable key, lowercase, no spaces. e.g. `india` |
| `name` | text | Display name |
| `iso_code` | text | ISO 3166-1 alpha-3 |
| `slug` | text | URL segment |
| `display_order` | integer | Row order in the matrix |
| `composite_score` | number | Optional; blank if `show_composite` is FALSE |
| `summary` | text | Narrative paragraph for the country page |

### Tab: `pillars`

| Column | Type | Notes |
|---|---|---|
| `pillar_id` | text | Stable key. e.g. `infrastructure` |
| `name` | text | Display name |
| `description` | text | One or two sentences, used on the methodology page |
| `display_order` | integer | Column order in the matrix |
| `weight` | number | Optional. Displayed on methodology if present |

### Tab: `scores`

One row per country-pillar pair. Exactly 15 rows for a 3 x 5 index.

| Column | Type | Notes |
|---|---|---|
| `country_id` | text | Must exist in `countries` |
| `pillar_id` | text | Must exist in `pillars` |
| `score` | number | Within `score_min`..`score_max` |
| `rationale` | text | Why this score was assigned |

### Tab: `references`

Zero or more rows per country-pillar pair.

| Column | Type | Notes |
|---|---|---|
| `country_id` | text | Must exist in `countries` |
| `pillar_id` | text | Must exist in `pillars` |
| `title` | text | Link text |
| `publisher` | text | e.g. World Bank |
| `url` | text | Must be `https://` |
| `published_date` | date | Optional |

### Template hardening

Half the failure modes are prevented in the template rather than the parser.

- Format each tab's data range as a **named Excel Table**: `tbl_meta`,
  `tbl_countries`, `tbl_pillars`, `tbl_scores`, `tbl_references`. Required if
  the client later moves to a Power Automate trigger, and free to do now.
- Data-validation dropdowns on `country_id` and `pillar_id` in `scores` and
  `references`, sourced from the `countries` and `pillars` tabs.
- Numeric validation on `score`.
- Protect sheet structure so columns cannot be inserted, renamed, or reordered.
  Leave cells editable.
- A hidden `_template_version` cell so the parser can refuse a workbook whose
  shape has drifted.
- No merged cells. No colour used to carry meaning. No formulas whose displayed
  value differs from the underlying value.

Ship a `template/README.md` alongside it telling the client's team: never insert
or rename columns, keep one row per record, and **never put internal notes in
this workbook — everything in it becomes public.**

---

## 2. Validation rules

Run in this order. Structural failures stop the run; content failures are all
collected so the admin sees every problem at once rather than one per upload.

### Structural — errors, stop on failure

- All five tabs present.
- All required columns present in each tab, matched by header name.
- `_template_version` present and recognised.
- No duplicate `country_id` in `countries`, no duplicate `pillar_id` in
  `pillars`.
- Exactly one `scores` row per country-pillar pair — none missing, none
  duplicated. Report missing pairs by name.
- Every `country_id` and `pillar_id` in `scores` and `references` resolves.

### Content — errors, collect all

- `score` is numeric and within range.
- `rationale` is non-empty and within a character cap (suggest 1,200; report
  overlong text as an error so layout cannot break silently).
- `summary` non-empty for every country.
- `as_of` parses as `YYYY-MM` and is not in the future.
- `slug` is URL-safe and unique.
- `score_bands` parses and covers the full range without gaps or overlaps.
- Every `url` is well-formed and uses `https://`.

### Warnings — never block a publish

- A reference URL does not return 200. Check with a `HEAD` request, 5s timeout,
  concurrency capped at 5, and treat a timeout as a warning rather than a
  failure. Link rot across a year is expected.
- Rationale under 100 characters — probably a placeholder left in.
- A country has no references for a pillar.
- `composite_score` present but inconsistent with the pillar scores and
  weights.

### Sanitisation — applied on the way in, always

- Strip all HTML tags from every text field.
- Normalise smart quotes, non-breaking spaces, and the encoding artefacts Excel
  introduces.
- Trim whitespace.

Store the sanitised text. Never sanitise only at render time — one missed call
site and the site is defaceable.

### Diff report

Compare the incoming snapshot against the currently published one and return a
structured diff:

```ts
type Diff = {
  scoresChanged:   { country: string; pillar: string; from: number; to: number }[]
  rationalesEdited:{ country: string; pillar: string }[]
  referencesAdded:   { country: string; pillar: string; title: string }[]
  referencesRemoved: { country: string; pillar: string; title: string }[]
  countriesAdded: string[]
  countriesRemoved: string[]
  metaChanged: string[]
}
```

If there is no published snapshot yet, return the diff as "first publish".

---

## 3. Mongo schema

One collection, `snapshots`. **One document per publish holding the entire
dataset.** Do not normalise into separate collections — a publish is atomic,
retrieving any month is one query, and rollback cannot produce a mismatched
mixture.

```ts
{
  _id: ObjectId,
  version: 7,                    // monotonic, never reused, never reordered
  as_of: "2026-09",              // the data period, from the meta tab
  status: "published",           // "draft" | "published" | "archived"

  created_at: ISODate,
  created_by: "analyst@example.com",
  published_at: ISODate | null,
  published_by: string | null,

  source_file: {
    filename: "index-sep-2026.xlsx",
    size_bytes: 48213,
    checksum: "sha256:...",         // detects a re-upload of an identical file
    container: "index-uploads",     // Azure Blob container
    blob_path: "snapshots/v7/index-sep-2026.xlsx",
    uploaded_at: ISODate
  },

  validation: {
    passed: true,
    errors: [],
    warnings: [{ code, message, tab, row, column }]
  },

  diff_from_published: Diff | null,

  payload: {                      // exactly the shape served to the client
    meta: {...},
    countries: [...],
    pillars: [...],
    scores: [...],                // each score carries its references inline
    // optional: indicators[] under a score, for future sub-indicator support
  }
}
```

**Keep `version` and `as_of` separate.** If September's data publishes and
someone spots a typo, the correction is version 8 but still `as_of: "2026-09"`.
Collapsing them makes corrections unrepresentable — which is exactly when the
audit trail matters most.

Roughly 200KB per document, comfortably inside Mongo's 16MB limit, about twelve
documents a year.

### Indexes

```
{ version: -1 }              unique
{ status: 1, version: -1 }   for the published lookup
{ as_of: 1, version: -1 }    for history queries later
```

### Invariants

- **Nothing is ever deleted.** Superseded snapshots become `archived`.
- **Exactly one document has `status: "published"`** at any time. Enforce this
  in the publish transaction, not by convention.
- `version` is allocated by an atomic increment, not by counting documents.
- **Every snapshot points at a blob that exists.** Write the file to storage
  before creating the document, never after.

---

## 4. Payload served to the client

Denormalised for rendering. References nest inside their score so the detail
drawer needs no joins.

```ts
{
  meta: {
    index_name: string,
    as_of: string,
    intro: string,
    score_min: number,
    score_max: number,
    score_bands: { min: number, max: number, label: string }[],
    show_composite: boolean,
    methodology: { framework, scoring, sources, assumptions },
    disclaimer: string
  },
  countries: [{
    country_id, name, iso_code, slug, display_order,
    composite_score: number | null,
    summary: string
  }],
  pillars: [{ pillar_id, name, description, display_order, weight }],
  scores: [{
    country_id, pillar_id, score, rationale,
    references: [{ title, publisher, url, published_date }]
  }]
}
```

Band colours are derived from `score_bands` at render time. Do not store hex
values in the spreadsheet — the client will pick colours that fail contrast
checks.
