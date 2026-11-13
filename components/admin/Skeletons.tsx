import { Loading, Skel, SkelText } from "@/components/ui/Skeleton";
import { SectionHead } from "./Page";

/* Admin placeholders, shown while a page's data is read from the store. Each mirrors the
 * real layout — the same cards, the same table markup and columns — so nothing jumps when
 * the content arrives. Headings that don't depend on the data are shown as they are. */

/** The version table (and its narrow list form), with placeholder rows. */
export function VersionTableSkeleton({ rows = 5 }: { rows?: number }) {
  const r = Array.from({ length: rows }, (_, i) => i);
  return (
    <div className="ver-wrap">
      <div className="ver-wide admin-card overflow-x-auto">
        <table className="ver-table w-full text-[14px]" aria-hidden>
          <thead>
            <tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Uploaded by</th><th scope="col">Uploaded on</th><th scope="col">Validation</th><th scope="col" /></tr>
          </thead>
          <tbody>
            {r.map((i) => (
              <tr key={i}>
                <th scope="row"><Skel className="h-4 w-24" /><Skel className="mt-1.5 h-3 w-20" /><Skel className="mt-1.5 h-3 w-40" /></th>
                <td><Skel className="h-4 w-14" /></td>
                <td><Skel className="h-4 w-32" /><Skel className="mt-1.5 h-3 w-40" /></td>
                <td><Skel className="h-4 w-32" /></td>
                <td><Skel className="h-4 w-28" /></td>
                <td><div className="flex items-center justify-end gap-1.5"><Skel className="h-9 w-24" /><Skel className="size-8" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="ver-narrow admin-card divide-y divide-line" aria-hidden>
        {r.map((i) => (
          <li key={i} className="px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3"><div><Skel className="h-4 w-36" /><Skel className="mt-1.5 h-3 w-44" /></div><Skel className="h-5 w-16" /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Skel className="h-3.5 w-32" /><Skel className="h-3.5 w-28" /><Skel className="h-3.5 w-24" /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Field = ({ w, wide = false }: { w: string; wide?: boolean }) => (
  <div className={`min-w-0 ${wide ? "pub-wide" : ""}`}><Skel className="h-3 w-20" /><Skel className={`mt-1.5 h-4 ${w}`} /></div>
);

/** Overview: the current publication card, then recent versions. */
export function OverviewSkeleton() {
  return (
    <Loading label="Loading overview">
      <SectionHead id="current-h-skel" title="Current publication" />
      <div className="admin-card pub-row" aria-hidden>
        <Field w="w-28" /><Field w="w-20" /><Field w="w-14" /><Field w="w-24" /><Field w="w-36" wide />
        <Skel className="pub-action h-9 w-36" />
      </div>
      <div className="mt-10"><SectionHead id="recent-h-skel" title="Recent versions" /></div>
      <VersionTableSkeleton rows={4} />
    </Loading>
  );
}

/** Version history: the search and filter row, the count line, then the table. */
export function HistorySkeleton() {
  return (
    <Loading label="Loading version history">
      <div aria-hidden className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Skel className="h-11 min-w-[240px] flex-[1_1_320px]" /><Skel className="h-11 w-[226px]" /><Skel className="h-11 w-[190px]" /><Skel className="h-11 w-[190px]" />
      </div>
      <Skel className="mb-3 h-3.5 w-56" />
      <VersionTableSkeleton rows={6} />
    </Loading>
  );
}

/** A version's page: title and actions, the review sections, the details aside. Publish
 *  can't be reached until the real page (and its checks) has loaded. */
export function VersionSkeleton() {
  const block = (title: string, body: React.ReactNode) => (
    <section>
      <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {body}
    </section>
  );
  return (
    <Loading label="Loading version">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><Skel className="h-3.5 w-28" /><Skel className="mt-4 h-9 w-48" /><Skel className="mt-3 h-4 w-80 max-w-full" /></div>
        <div className="flex gap-2"><Skel className="h-9 w-24" /><Skel className="h-9 w-24" /><Skel className="h-9 w-28" /></div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid min-w-0 gap-8">
          {block("Validation", <div className="admin-card grid gap-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="grid grid-cols-[72px_160px_1fr] gap-4"><Skel className="h-3.5" /><Skel className="h-3.5" /><Skel className="h-3.5" /></div>)}</div>)}
          {block("Change summary", <div className="admin-card p-5"><Skel className="h-4 w-2/3" /><div className="mt-4 grid gap-3">{[0, 1, 2].map((i) => <div key={i} className="grid grid-cols-[1fr_1fr_120px] gap-4"><Skel className="h-3.5" /><Skel className="h-3.5" /><Skel className="h-3.5" /></div>)}</div></div>)}
          {block("Activity", <div className="admin-card grid gap-4 px-5 py-4">{[0, 1, 2].map((i) => <div key={i}><Skel className="h-4 w-44" /><Skel className="mt-1.5 h-3 w-56" /></div>)}</div>)}
        </div>
        <aside className="admin-card p-5">
          <h2 className="text-[15px] font-semibold text-ink">Details</h2>
          <div className="mt-3 grid gap-3">{["w-10", "w-28", "w-16", "w-48", "w-40", "w-36"].map((w, i) => <div key={i}><Skel className="h-3 w-24" /><Skel className={`mt-1.5 h-4 ${w}`} /></div>)}</div>
        </aside>
      </div>
    </Loading>
  );
}

/** Upload: the template row and the file picker's frame (the picker itself is never a
 *  skeleton once it's there). */
export function UploadSkeleton() {
  return (
    <Loading label="Loading upload form">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div><Skel className="h-4 w-44" /><Skel className="mt-1.5 h-3.5 w-64" /></div>
        <Skel className="h-9 w-44" />
      </div>
      <div className="drop-zone grid h-[180px] place-items-center"><SkelText className="w-56" widths={[100, 70]} /></div>
    </Loading>
  );
}

export function StepsSkeleton() {
  return (
    <div aria-hidden className="mt-3 grid gap-3.5">
      {[0, 1, 2, 3].map((i) => <div key={i} className="flex gap-3"><Skel className="size-6 shrink-0 rounded-full" /><div className="w-full"><Skel className="h-4 w-36" /><SkelText className="mt-1.5" widths={[100, 80]} line="h-3" gap="gap-1.5" /></div></div>)}
    </div>
  );
}
