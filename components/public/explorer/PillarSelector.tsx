"use client";
import { COMPOSITE, useExplorer } from "./ExplorerContext";

/** Compact measure selector: the workbook's composite option (when enabled) plus every
 *  pillar. Native radios, so arrow keys move between options; pills wrap, never scroll. */
export function PillarSelector() {
  const { summary, measure, setMeasure } = useExplorer();
  const options = [
    ...(summary.meta.show_composite ? [{ id: COMPOSITE, name: "Composite" }] : []),
    ...summary.pillars.map((p) => ({ id: p.pillar_id, name: p.name })),
  ];
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Colour the map by</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={o.id} className="cursor-pointer">
            <input type="radio" name="measure" value={o.id} checked={measure === o.id} onChange={() => setMeasure(o.id)} className="peer sr-only" />
            <span className="inline-flex h-9 items-center border border-line-strong bg-raised px-3.5 text-[13.5px] font-medium text-ink-2 hover:border-ink hover:text-ink
              peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
              {o.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
