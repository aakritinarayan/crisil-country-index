import ALPHA2 from "@/data/iso-alpha3-to-alpha2.json";

/** A country's flag emoji from its ISO alpha-3 code (a regional-indicator pair), or null.
 *  Decorative: the country's name always carries the meaning. */
export function flagOf(iso3: string): string | null {
  const a2 = (ALPHA2 as Record<string, string>)[iso3];
  return a2 ? String.fromCodePoint(...[...a2].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : null;
}
