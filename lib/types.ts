// The payload served to the client — DATA_MODEL.md §4. This shape is the contract.

export type ScoreBand = { min: number; max: number; label: string };

export type Meta = {
  index_name: string;
  as_of: string; // YYYY-MM
  intro: string;
  score_min: number;
  score_max: number;
  score_bands: ScoreBand[];
  show_composite: boolean;
  methodology: { framework: string; scoring: string; sources: string; assumptions: string };
  disclaimer: string;
  sample?: boolean; // false for real assessment data; the sample-data notice shows only when not false
};

export type Country = {
  country_id: string;
  name: string;
  iso_code: string; // ISO 3166-1 alpha-3
  slug: string;
  display_order: number;
  composite_score: number | null;
  summary: string;
};

export type Pillar = {
  pillar_id: string;
  name: string;
  description: string;
  display_order: number;
  weight: number | null;
};

export type Reference = { title: string; publisher: string; url: string; published_date: string | null };

export type Score = {
  country_id: string;
  pillar_id: string;
  score: number;
  rationale: string;
  references: Reference[];
};

/* KPI-level detail, present when the data comes from the assessment framework (lib/cfe):
 * each pillar score is built from weighted KPIs scored on a short scale (1–5), some of
 * them once per procurement route. The pillar and composite scores above are calculated
 * from these; the site shows them as the evidence behind a pillar score. */
export type KpiLevel = { score: number; label: string };
export type KpiDef = {
  kpi_id: string; pillar_id: string; name: string; group: string | null; description: string; weight: number;
  anchors: { high: string; moderate: string; low: string }; by_route: boolean; display_order: number;
};
export type KpiRouteScore = { route_id: string; name: string; score: number | null; finding: string; rationale: string };
export type KpiScore = {
  country_id: string; kpi_id: string;
  score: number | null;               // on the KPI scale; the route average for by-route KPIs; null = not assessed
  finding: string; rationale: string; // for a single-score KPI
  routes: KpiRouteScore[] | null;     // for a by-route KPI
  references: Reference[];
};
export type FrameworkDetail = { scale: { min: number; max: number }; levels: KpiLevel[]; kpis: KpiDef[]; kpi_scores: KpiScore[] };

export type Payload = { meta: Meta; countries: Country[]; pillars: Pillar[]; scores: Score[]; framework?: FrameworkDetail };

/** What the landing page ships to the browser: numbers only, no rationale text.
 *  Rationale and references load per country when a score is opened, so the page
 *  stays light at 200+ countries. */
export type IndexSummary = {
  meta: Meta;
  pillars: Pillar[];
  countries: (Country & { scores: Record<string, number>; rank: number })[];
};
