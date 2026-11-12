/* Dates in the console. Times are shown in ADMIN_TIME_ZONE (default UTC) so every
 * administrator reads the same timestamp; the zone is named where precision matters. */
const tz = () => process.env.ADMIN_TIME_ZONE || "UTC";

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz() }).format(new Date(iso));
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz() }).format(new Date(iso));
export const zoneName = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz(), timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz();
export const fmtPeriod = (asOf: string) => {
  const [y, m] = asOf.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
};
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
