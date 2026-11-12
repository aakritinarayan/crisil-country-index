/** "1 country", "3 countries" — counts are data-driven, so a single country happens. */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const nCountries = (n: number) => plural(n, "country", "countries");
