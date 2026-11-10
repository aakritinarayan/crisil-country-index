import { countryDetail, getPublishedSnapshot } from "@/lib/data";

// Per-country rationale + references, loaded when a score is opened.
// Prerendered for every country, so it is static like the pages.
export async function generateStaticParams() {
  const p = await getPublishedSnapshot();
  return p ? p.countries.map((c) => ({ slug: c.slug })) : [];
}

export async function GET(_req: Request, ctx: RouteContext<"/data/country/[slug]">) {
  const { slug } = await ctx.params;
  const p = await getPublishedSnapshot();
  const d = p && countryDetail(p, slug);
  if (!d) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(d);
}
