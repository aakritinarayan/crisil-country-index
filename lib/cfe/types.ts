/* The assessment framework as the client maintains it:
 * weighted pillars → weighted KPIs scored 1–5 → for some KPIs, one score per procurement
 * route, averaged. This is the shape of the upload template (lib/cfe/template.ts) and of a
 * version's source data; lib/cfe/compute.ts turns it into the payload the site renders.
 * Every number on the public site is calculated from this — never copied from workbook
 * formulas. */
import type { ScoreBand } from "@/lib/types";

/** A defined point on the KPI scale, e.g. 1 = Low, 3 = Moderate, 5 = High. */
export type Level = { score: number; label: string };

export type FMeta = {
  index_name: string;
  as_of: string;                      // YYYY-MM
  intro: string;
  disclaimer: string;
  methodology: { framework: string; scoring: string; sources: string; assumptions: string };
  scale_min: number;                  // KPI scale, 1
  scale_max: number;                  // 5
  levels: Level[];                    // the anchored scores (1/3/5)
  bands: ScoreBand[];                 // readiness bands for pillar and composite scores, 0–100
  show_composite: boolean;
  sample: boolean;                    // true only for placeholder data (drives the sample notice)
};

export type FPillar = { pillar_id: string; name: string; description: string; weight: number; weight_rationale: string; display_order: number };

export type FKpi = {
  kpi_id: string;
  pillar_id: string;
  name: string;
  group: string | null;               // sub-heading inside a pillar, e.g. "Market size"
  description: string;
  weight: number;                     // share of its pillar; a pillar's KPI weights sum to 1
  anchor_high: string;                // what 5 means
  anchor_moderate: string;            // what 3 means
  anchor_low: string;                 // what 1 means
  by_route: boolean;                  // scored once per procurement route, then averaged
  display_order: number;
};

export type FRoute = { route_id: string; name: string; display_order: number };

export type FCountry = { country_id: string; name: string; iso_code: string; slug: string; display_order: number; summary: string };

/** One judgement: a country's score on a KPI (or on one route of a by-route KPI).
 *  score null = not assessed (e.g. data not publicly available) — excluded from the
 *  averages, never counted as zero. */
export type FAssessment = { country_id: string; kpi_id: string; route_id: string | null; score: number | null; finding: string; rationale: string };

export type FSource = { country_id: string; kpi_id: string; route_id: string | null; title: string; publisher: string; url: string; published_date: string | null };

export type Framework = {
  meta: FMeta;
  pillars: FPillar[];
  kpis: FKpi[];
  routes: FRoute[];
  countries: FCountry[];
  assessments: FAssessment[];
  sources: FSource[];
};
