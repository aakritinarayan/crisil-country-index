import ExcelJS from "exceljs";
import { META_FIELDS, TABS, TEMPLATE_VERSION } from "./template";
import type { Issue } from "@/lib/admin/types";

/* Workbook → raw rows, by header name. Text is sanitised here, on ingest (CLAUDE.md): any
 * HTML tags are stripped and whitespace normalised before anything is stored, so nothing
 * from a workbook can reach a page as markup. Scans to rowCount, not actualRowCount (a
 * blanked row mid-table must not hide the rows after it). */

export type RawRow = { row: number; values: Record<string, string> };
export type RawWorkbook = { meta: Record<string, { value: string; row: number }>; tabs: Record<string, RawRow[]> };

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v) return String(v.hyperlink ?? v.text ?? "");
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
  }
  return String(v);
};

export const sanitise = (s: string) =>
  s.replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export async function readWorkbook(buf: Buffer): Promise<{ wb: RawWorkbook | null; issues: Issue[] }> {
  const issues: Issue[] = [];
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { wb: null, issues: [{ code: "file.unreadable", message: "This file couldn’t be read as an Excel workbook. Save it as .xlsx and upload it again." }] };
  }

  const tabs: Record<string, RawRow[]> = {};
  for (const t of TABS) {
    const ws = book.getWorksheet(t.name);
    if (!ws) { issues.push({ code: "tab.missing", message: `The “${t.name}” tab is missing. Start from the template downloaded from the admin.`, tab: t.name }); continue; }
    const header = new Map<string, number>();
    ws.getRow(1).eachCell((cell, col) => { const h = sanitise(cellText(cell.value)).toLowerCase(); if (h) header.set(h, col); });
    for (const col of t.columns.filter((x) => x.required)) {
      if (!header.has(col.key)) issues.push({ code: "column.missing", message: `Required column “${col.key}” is missing. Headers must match the template exactly.`, tab: t.name, row: 1, column: col.key });
    }
    const rows: RawRow[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const values: Record<string, string> = {};
      for (const col of t.columns) { const i = header.get(col.key); values[col.key] = i ? sanitise(cellText(row.getCell(i).value)) : ""; }
      if (Object.values(values).some(Boolean)) rows.push({ row: r, values });
    }
    tabs[t.name] = rows;
  }

  const meta: RawWorkbook["meta"] = {};
  for (const r of tabs.meta ?? []) if (r.values.field) meta[r.values.field] = { value: r.values.value, row: r.row };
  if (tabs.meta) {
    for (const f of META_FIELDS) if (!(f in meta)) issues.push({ code: "meta.missing", message: `The meta tab has no “${f}” row.`, tab: "meta", column: "field" });
    const tv = meta.template_version?.value;
    if (tv && tv !== TEMPLATE_VERSION) issues.push({ code: "template.version", message: `This workbook uses template “${tv}”; the admin expects “${TEMPLATE_VERSION}”. Download the current template and move your data across.`, tab: "meta", row: meta.template_version.row, column: "value" });
  }
  return { wb: issues.length ? null : { meta, tabs }, issues };
}
