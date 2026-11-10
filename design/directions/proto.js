/* Shared prototype logic for the visual-direction mockups.
 * Everything renders from window.PAYLOAD (the spec's payload shape, built from
 * the real workbook). All workbook text goes in via textContent — never innerHTML. */
(function () {
  const P = window.PAYLOAD;
  const RAMP = window.BAND_RAMP; // [{bg, fg}] per direction, light → dark
  const $ = (s, el = document) => el.querySelector(s);

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }

  // ---- data helpers (nothing hardcoded: counts, names, bands all from payload)
  const M = P.meta;
  const bands = M.score_bands;
  const bandIndex = (s) => bands.findIndex((b) => s >= b.min && s <= b.max);
  const bandColour = (i) => RAMP[Math.round((i * (RAMP.length - 1)) / Math.max(1, bands.length - 1))];
  const band = (s) => { const i = bandIndex(s); return { i, ...bands[i], ...bandColour(i) }; };
  const countries = [...P.countries].sort((a, b) => a.display_order - b.display_order);
  const pillars = [...P.pillars].sort((a, b) => a.display_order - b.display_order);
  const score = (c, p) => P.scores.find((s) => s.country_id === c && s.pillar_id === p);
  const pct = (s) => ((s - M.score_min) / (M.score_max - M.score_min)) * 100;
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const asOf = (() => {
    const [y, m] = M.as_of.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  })();
  const composite = (c) =>
    c.composite_score ??
    pillars.reduce((t, p) => t + score(c.country_id, p.pillar_id).score, 0) / pillars.length;

  function chip(s, extra = "") {
    const b = band(s);
    return h("span", { class: "chip " + extra, style: `--bg:${b.bg};--fg:${b.fg}` },
      h("span", { class: "chip-num" }, fmtNum(s)),
      h("span", { class: "chip-label" }, b.label));
  }

  // ---- header + hero
  function renderTop() {
    document.querySelectorAll("[data-index-name]").forEach((e) => (e.textContent = M.index_name));
    document.querySelectorAll("[data-asof]").forEach((e) => (e.textContent = asOf));
    $("#intro").textContent = M.intro;
    $("#disclaimer").textContent = M.disclaimer;

    const all = P.scores.map((s) => s.score);
    const top = [...countries].sort((a, b) => composite(b) - composite(a))[0];
    const pAvg = pillars.map((p) => ({ p, avg: countries.reduce((t, c) => t + score(c.country_id, p.pillar_id).score, 0) / countries.length }))
      .sort((a, b) => b.avg - a.avg);
    const tiles = [
      { k: "Countries assessed", v: countries.length, s: `${pillars.length} pillars each` },
      { k: "Highest composite", v: fmtNum(composite(top)), s: top.name },
      { k: "Strongest pillar", v: fmtNum(+pAvg[0].avg.toFixed(1)), s: `${pAvg[0].p.name}, average` },
      { k: "Score range", v: `${fmtNum(Math.min(...all))}–${fmtNum(Math.max(...all))}`, s: `on a ${M.score_min}–${M.score_max} scale` },
    ];
    $("#tiles").replaceChildren(...tiles.map((t) =>
      h("div", { class: "tile" }, h("div", { class: "tile-k" }, t.k), h("div", { class: "tile-v num" }, t.v), h("div", { class: "tile-s" }, t.s))));
  }

  // ---- the matrix (desktop) + cards (mobile)
  function cellButton(c, p, cls) {
    const s = score(c.country_id, p.pillar_id);
    const b = band(s.score);
    return h("button", {
      class: cls, type: "button", "data-c": c.country_id, "data-p": p.pillar_id, "data-band": b.i,
      style: `--bg:${b.bg};--fg:${b.fg};--pct:${pct(s.score)}%`,
      "aria-label": `${c.name}, ${p.name}: ${fmtNum(s.score)}, ${b.label}. Open rationale and sources`,
      onclick: (e) => openDrawer(c.country_id, p.pillar_id, e.currentTarget),
    },
      h("span", { class: "cell-num num" }, fmtNum(s.score)),
      h("span", { class: "cell-label" }, b.label),
      h("span", { class: "cell-bar", "aria-hidden": "true" }, h("span")));
  }

  function renderMatrix() {
    const head = h("tr", null,
      h("th", { scope: "col", class: "corner" }, "Country"),
      pillars.map((p, j) => h("th", { scope: "col", "data-col": j }, h("span", { class: "th-name" }, p.name))),
      M.show_composite ? h("th", { scope: "col", class: "comp-h" }, "Composite") : null);
    const rows = countries.map((c, i) => h("tr", { "data-row": i },
      h("th", { scope: "row" }, h("a", { href: "#", class: "country-link", onclick: (e) => e.preventDefault() },
        h("span", { class: "iso" }, c.iso_code), c.name)),
      pillars.map((p, j) => h("td", { "data-col": j }, cellButton(c, p, "cell"))),
      M.show_composite ? h("td", { class: "comp" }, chip(+fmtNum(composite(c)), "chip-lg")) : null));
    const table = h("table", { class: "matrix" },
      h("caption", { class: "sr-only" }, `${M.index_name} scores by country and pillar, ${asOf}`),
      h("thead", null, head), h("tbody", null, rows));
    // row/column crosshair highlight
    table.addEventListener("pointerover", (e) => mark(e.target.closest("td,th")));
    table.addEventListener("focusin", (e) => mark(e.target.closest("td,th")));
    table.addEventListener("pointerleave", () => mark(null));
    table.addEventListener("focusout", () => mark(null));
    function mark(cell) {
      table.querySelectorAll(".hl").forEach((e) => e.classList.remove("hl"));
      if (!cell || !cell.dataset.col) return;
      const tr = cell.closest("tr");
      tr.classList.add("hl");
      table.querySelectorAll(`[data-col="${cell.dataset.col}"]`).forEach((e) => e.classList.add("hl"));
    }
    $("#matrix").replaceChildren(table);

    $("#cards").replaceChildren(...countries.map((c) =>
      h("article", { class: "card" },
        h("header", { class: "card-h" },
          h("h3", null, h("span", { class: "iso" }, c.iso_code), c.name),
          M.show_composite ? chip(+fmtNum(composite(c)), "chip-lg") : null),
        h("ul", { class: "card-list" }, pillars.map((p) =>
          h("li", null, h("span", { class: "card-p" }, p.name), cellButton(c, p, "cell cell-row")))))));
  }

  // ---- legend (interactive: hover/focus a band to spotlight its cells)
  function renderLegend() {
    const counts = bands.map((_, i) => P.scores.filter((s) => bandIndex(s.score) === i).length);
    const items = bands.map((b, i) => {
      const c = bandColour(i);
      return h("li", null, h("button", {
        type: "button", class: "legend-item", "aria-pressed": "false", style: `--bg:${c.bg};--fg:${c.fg}`,
        onmouseenter: () => spot(i), onmouseleave: () => spot(null), onfocus: () => spot(i), onblur: () => spot(null),
        onclick: (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; document.querySelectorAll(".legend-item").forEach((x) => x.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", String(on)); pinned = on ? i : null; spot(pinned); },
      },
        h("span", { class: "legend-sw" }, `${b.min}–${b.max}`),
        h("span", { class: "legend-l" }, b.label),
        h("span", { class: "legend-n num" }, `${counts[i]}`)));
    });
    let pinned = null;
    function spot(i) {
      const v = i ?? pinned;
      document.body.toggleAttribute("data-spot", v != null);
      document.querySelectorAll(".cell").forEach((c) => c.classList.toggle("dim", v != null && +c.dataset.band !== v));
    }
    $("#legend").replaceChildren(h("ul", { class: "legend" }, items));
  }

  // ---- pillar spread dot plot (each pillar: where every country sits on the scale)
  function renderSpread() {
    const rows = pillars.map((p) => {
      const pts = countries.map((c) => ({ c, s: score(c.country_id, p.pillar_id).score }));
      return h("div", { class: "spread-row" },
        h("div", { class: "spread-name" }, p.name),
        h("div", { class: "spread-track" },
          bands.map((b, i) => h("span", { class: "spread-band", style: `left:${pct(b.min)}%;width:${pct(b.max + 1) - pct(b.min)}%;--bg:${bandColour(i).bg}` })),
          pts.map(({ c, s }) => h("button", {
            type: "button", class: "dot", style: `left:${pct(s)}%;--bg:${band(s).bg};--fg:${band(s).fg}`,
            "data-c": c.country_id, "aria-label": `${c.name}, ${p.name}: ${fmtNum(s)}`,
            onclick: (e) => openDrawer(c.country_id, p.pillar_id, e.currentTarget),
            onmouseenter: () => focusCountry(c.country_id), onmouseleave: () => focusCountry(null),
            onfocus: () => focusCountry(c.country_id), onblur: () => focusCountry(null),
          }, h("span", { class: "dot-tip" }, `${c.iso_code} ${fmtNum(s)}`)))));
    });
    const key = h("div", { class: "spread-key" }, countries.map((c) =>
      h("button", { type: "button", class: "key-item", onmouseenter: () => focusCountry(c.country_id), onmouseleave: () => focusCountry(null), onfocus: () => focusCountry(c.country_id), onblur: () => focusCountry(null) }, h("span", { class: "iso" }, c.iso_code), c.name)));
    function focusCountry(id) {
      document.querySelectorAll(".dot").forEach((d) => {
        d.classList.toggle("on", d.dataset.c === id);
        d.classList.toggle("dim", id != null && d.dataset.c !== id);
      });
    }
    $("#spread").replaceChildren(key, ...rows,
      h("div", { class: "spread-axis num", "aria-hidden": "true" },
        [M.score_min, Math.round((M.score_min + M.score_max) / 2), M.score_max].map((v) => h("span", { style: `left:${pct(v)}%` }, v))));
  }

  // ---- drawer (deep-linkable, focus trapped, Esc closes, prev/next)
  let opener = null;
  const drawer = () => $("#drawer");
  function openDrawer(cid, pid, from) {
    opener = from || opener;
    const c = countries.find((x) => x.country_id === cid);
    const pi = pillars.findIndex((x) => x.pillar_id === pid);
    const p = pillars[pi];
    const s = score(cid, pid);
    const b = band(s.score);
    const d = drawer();
    const prev = pillars[(pi - 1 + pillars.length) % pillars.length];
    const next = pillars[(pi + 1) % pillars.length];
    $(".drawer-body", d).replaceChildren(
      h("p", { class: "eyebrow" }, h("span", { class: "iso" }, c.iso_code), c.name),
      h("h2", { id: "drawer-title" }, p.name),
      h("div", { class: "d-score", style: `--bg:${b.bg};--fg:${b.fg}` },
        h("span", { class: "d-num num" }, fmtNum(s.score)),
        h("span", { class: "d-meta" }, h("strong", null, b.label), h("span", null, `${b.min}–${b.max} band · scale ${M.score_min}–${M.score_max}`))),
      h("div", { class: "scale", "aria-hidden": "true" },
        bands.map((bb, i) => h("span", { class: "scale-seg", style: `flex:${bb.max - bb.min + 1};--bg:${bandColour(i).bg};--fg:${bandColour(i).fg}` }, h("span", null, bb.label))),
        h("span", { class: "scale-pin", style: `left:${pct(s.score)}%` })),
      h("h3", null, "Why this score"),
      h("p", { class: "rationale" }, s.rationale),
      h("h3", null, `Sources (${s.references.length})`),
      s.references.length ? h("ul", { class: "refs" }, s.references.map((r) =>
        h("li", null, h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" },
          h("span", { class: "ref-t" }, r.title),
          h("span", { class: "ref-m" }, [r.publisher, r.published_date && new Date(r.published_date).toLocaleString("en-GB", { month: "short", year: "numeric" })].filter(Boolean).join(" · ")),
          h("span", { class: "ref-x", "aria-hidden": "true" }, "↗"))))) : h("p", { class: "muted" }, "No sources listed for this score."),
    );
    $(".drawer-nav", d).replaceChildren(
      h("button", { type: "button", class: "btn-ghost", onclick: () => openDrawer(cid, prev.pillar_id) }, "← ", prev.name),
      h("button", { type: "button", class: "btn-ghost", onclick: () => openDrawer(cid, next.pillar_id) }, next.name, " →"));
    $(".drawer-foot", d).replaceChildren(h("a", { href: "#", class: "btn-primary", onclick: (e) => e.preventDefault() }, `View full ${c.name} page →`));
    const wasOpen = d.classList.contains("open");
    d.hidden = false; $("#scrim").hidden = false;
    requestAnimationFrame(() => { d.classList.add("open"); $("#scrim").classList.add("open"); });
    document.body.classList.add("locked");
    history.replaceState(null, "", `?country=${encodeURIComponent(cid)}&pillar=${encodeURIComponent(pid)}`);
    if (!wasOpen) $(".drawer-close", d).focus(); else $("#drawer-title").setAttribute("tabindex", "-1");
  }
  function closeDrawer() {
    const d = drawer();
    d.classList.remove("open"); $("#scrim").classList.remove("open");
    document.body.classList.remove("locked");
    history.replaceState(null, "", location.pathname);
    setTimeout(() => { d.hidden = true; $("#scrim").hidden = true; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
    if (opener && document.contains(opener)) opener.focus();
  }
  document.addEventListener("keydown", (e) => {
    const d = drawer();
    if (d.hidden) return;
    if (e.key === "Escape") closeDrawer();
    if (e.key === "Tab") {
      const f = [...d.querySelectorAll("a[href],button:not([disabled])")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });

  renderTop(); renderMatrix(); renderLegend(); renderSpread();
  $(".drawer-close").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", closeDrawer);
  const q = new URLSearchParams(location.search);
  if (q.get("country") && q.get("pillar") && score(q.get("country"), q.get("pillar"))) openDrawer(q.get("country"), q.get("pillar"));
})();
