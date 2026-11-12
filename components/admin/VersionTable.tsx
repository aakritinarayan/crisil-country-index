import Link from "next/link";
import type { VersionActions } from "@/lib/admin/permissions";
import { fmtDateTime, fmtPeriod } from "@/lib/admin/format";
import { versionLabel, type VersionRecord } from "@/lib/admin/types";
import { Eye } from "@/components/ui/icons";
import { ActionButton } from "./ActionButton";
import { RowMenu } from "./RowMenu";
import { ActorLabel, StatusLabel, ValidationLabel } from "./Status";

type Row = { v: VersionRecord; actions: VersionActions };

/** Versions newest first. A table when the workspace is wide enough, a stacked list
 *  otherwise — decided by the space available (container query), so it follows the
 *  sidebar's state, not just the screen. The version name opens the details view. */
export function VersionTable({ rows, caption }: { rows: Row[]; caption: string }) {
  const href = (v: VersionRecord) => `/admin/versions/${v.id}`;
  return (
    <div className="ver-wrap">
      <div className="ver-wide admin-card overflow-x-auto">
        <table className="ver-table w-full text-[14px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Version</th><th scope="col">Status</th><th scope="col">Uploaded by</th>
              <th scope="col">Uploaded on</th><th scope="col">Validation</th><th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, actions }) => (
              <tr key={v.id} className={v.status === "published" ? "is-live" : ""}>
                <th scope="row" className="max-w-[260px]">
                  <Link href={href(v)} className="ver-link">{versionLabel(v)}</Link>
                  <span className="block text-[13px] font-normal text-muted">{fmtPeriod(v.as_of)}</span>
                  <span className="block truncate text-[12.5px] font-normal text-muted" title={v.source_file.filename}>{v.source_file.filename}</span>
                </th>
                <td><StatusLabel v={v} /></td>
                <td className="max-w-[210px]"><ActorLabel actor={v.created_by} /></td>
                <td className="whitespace-nowrap text-ink-2 num">{fmtDateTime(v.created_at)}</td>
                <td><ValidationLabel v={v.validation} /></td>
                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionButton state={actions.preview} label="Preview" icon={Eye} href={`/admin/preview/${v.id}`} newTab reasonId={`pv-${v.id}`} />
                    <RowMenu label={`${versionLabel(v)}, ${fmtPeriod(v.as_of)}`} href={href(v)} actions={actions} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="ver-narrow admin-card divide-y divide-line" aria-label={caption}>
        {rows.map(({ v, actions }) => (
          <li key={v.id} className={`px-4 py-4 sm:px-5 ${v.status === "published" ? "is-live-row" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={href(v)} className="ver-link text-[15px]">{versionLabel(v)}</Link>
                <span className="text-[13.5px] text-muted"> · {fmtPeriod(v.as_of)}</span>
                <span className="block truncate text-[12.5px] text-muted" title={v.source_file.filename}>{v.source_file.filename}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2"><StatusLabel v={v} /><RowMenu label={`${versionLabel(v)}, ${fmtPeriod(v.as_of)}`} href={href(v)} actions={actions} /></div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-[12px] text-muted">Uploaded by</dt><dd className="min-w-0"><ActorLabel actor={v.created_by} compact /></dd></div>
              <div><dt className="text-[12px] text-muted">Uploaded on</dt><dd className="text-ink-2 num">{fmtDateTime(v.created_at)}</dd></div>
              <div><dt className="text-[12px] text-muted">Validation</dt><dd><ValidationLabel v={v.validation} /></dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
