/** Hero → map hand-off, shared by the globe, the CTA and the metrics.
 *  A visual transition rather than a geometric morph: the globe brightens and
 *  swells while the page scrolls to the explorer, and the map frame settles in.
 *  Reduced motion: an immediate jump. Focus always lands on the map heading, so
 *  keyboard and screen-reader users arrive in the same place. */
export function enterExplorer() {
  const map = document.getElementById("map");
  if (!map) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = document.getElementById("hero");
  if (!reduce) {
    hero?.setAttribute("data-entering", "");
    map.removeAttribute("data-arrive");
    void map.offsetWidth; // restart the arrival animation if it ran before
    map.setAttribute("data-arrive", "");
    window.setTimeout(() => hero?.removeAttribute("data-entering"), 900);
    window.setTimeout(() => map.removeAttribute("data-arrive"), 1200);
  }
  map.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  document.getElementById("explore-h")?.focus({ preventScroll: true });
  if (window.location.hash !== "#map") window.history.replaceState(null, "", "#map");
}
