// An anonymised framework with the structure of the client's assessment sheet (pillars
// weighted 30/25/15/30, by-route and single-score KPIs, one KPI not assessed), for tests.
const R = ["r1", "r2", "r3", "r4", "r5", "r6"];
const kpi = (kpi_id, pillar_id, weight, by_route) => ({ kpi_id, pillar_id, name: kpi_id, group: null, description: "", weight, anchor_high: "", anchor_moderate: "", anchor_low: "", by_route, display_order: 0 });
const routeScores = (kpi_id, scores) => scores.map((score, i) => ({ country_id: "in", kpi_id, route_id: R[i], score, finding: "", rationale: "x" }));
const single = (kpi_id, score) => ({ country_id: "in", kpi_id, route_id: null, score, finding: "", rationale: "x" });

export const framework = {
  meta: { index_name: "T", as_of: "2026-11", intro: "", disclaimer: "", methodology: { framework: "", scoring: "", sources: "", assumptions: "" },
    scale_min: 1, scale_max: 5, levels: [{ score: 1, label: "Low" }, { score: 3, label: "Moderate" }, { score: 5, label: "High" }], bands: [{ min: 0, max: 39, label: "Low" }, { min: 40, max: 69, label: "Moderate" }, { min: 70, max: 100, label: "High" }], show_composite: true, sample: false },
  pillars: [
    { pillar_id: "policy", name: "Policy", description: "", weight: 30, weight_rationale: "", display_order: 1 },
    { pillar_id: "market", name: "Market", description: "", weight: 25, weight_rationale: "", display_order: 2 },
    { pillar_id: "data", name: "Data", description: "", weight: 15, weight_rationale: "", display_order: 3 },
    { pillar_id: "cfe", name: "CFE", description: "", weight: 30, weight_rationale: "", display_order: 4 },
  ],
  kpis: [
    kpi("p1", "policy", 0.4, true), kpi("p2", "policy", 0.35, true), kpi("p3", "policy", 0.15, true), kpi("p4", "policy", 0.1, true),
    kpi("m1", "market", 0.3, false), kpi("m2", "market", 0.4, false), kpi("m3", "market", 0.15, false), kpi("m4", "market", 0.15, false),
    kpi("d1", "data", 0.3, false), kpi("d2", "data", 0.35, false), kpi("d3", "data", 0.35, false),
    kpi("c1", "cfe", 0.25, true), kpi("c2", "cfe", 0.4, true), kpi("c3", "cfe", 0.15, true), kpi("c4", "cfe", 0.2, true),
  ],
  routes: R.map((route_id, i) => ({ route_id, name: route_id, display_order: i + 1 })),
  countries: [{ country_id: "in", name: "Country A", iso_code: "AAA", slug: "country-a", display_order: 1, summary: "" }, { country_id: "id", name: "Country B", iso_code: "BBB", slug: "country-b", display_order: 2, summary: "" }],
  assessments: [
    ...routeScores("p1", [5, 5, 3, 5, 5, 1]), ...routeScores("p2", [5, 5, 3, 3, 1, 1]), ...routeScores("p3", [5, 5, 3, 5, 3, 4]), ...routeScores("p4", [5, 1, 5, 5, 5, 5]),
    single("m1", null), single("m2", 3), single("m3", 5), single("m4", 5),
    single("d1", 5), single("d2", 1), single("d3", 3),
    ...routeScores("c1", [5, 5, 5, 5, 5, 1]), ...routeScores("c2", [5, 5, 5, 1, 1, 1]), ...routeScores("c3", [5, 5, 1, 1, 5, 1]), ...routeScores("c4", [5, 5, 1, 1, 5, 1]),
  ],
  sources: [{ country_id: "in", kpi_id: "m3", route_id: null, title: "RE100", publisher: "", url: "https://example.org/re100", published_date: null }],
};

