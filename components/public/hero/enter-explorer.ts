/** Hero → explorer hand-off, shared by the globe, the CTA and the metrics: scroll to the
 *  Country Explorer. On lg and up that scroll is also what carries the hero globe into the
 *  explorer (ExploreWorkspace). Reduced motion: an immediate jump. Focus lands on the
 *  explorer heading, so keyboard and screen-reader users arrive in the same place. */
export function enterExplorer() {
  const map = document.getElementById("map");
  if (!map) return;
  const header = (document.querySelector("header") as HTMLElement | null)?.offsetHeight ?? 64;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: window.scrollY + map.getBoundingClientRect().top - header, behavior: reduce ? "auto" : "smooth" });
  document.getElementById("explore-h")?.focus({ preventScroll: true });
  if (window.location.hash !== "#map") window.history.replaceState(null, "", "#map");
}
