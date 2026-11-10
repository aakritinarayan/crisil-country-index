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

export type Payload = { meta: Meta; countries: Country[]; pillars: Pillar[]; scores: Score[] };

/** What the landing page ships to the browser: numbers only, no rationale text.
 *  Rationale and references load per country when a score is opened, so the page
 *  stays light at 200+ countries. */
export type IndexSummary = {
  meta: Meta;
  pillars: Pillar[];
  countries: (Country & { scores: Record<string, number>; rank: number })[];
};
