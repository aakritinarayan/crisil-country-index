import { Loading, Skel, SkelText } from "@/components/ui/Skeleton";

/* While the methodology renders on demand (only in preview — normally it is static): the
 * editorial layout of headings and paragraphs, nothing more. */
export default function MethodologyLoading() {
  return (
    <Loading label="Loading methodology" className="wrap pb-16">
      {/* the fixed wording is shown as is; only what comes from the data is a placeholder */}
      <header className="max-w-[1040px] border-b border-line pb-8 pt-10 sm:pt-12">
        <Skel className="h-3.5 w-56" />
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">Methodology</h1>
        <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed text-ink-2">
          Understand how countries are assessed, how scores are assigned and the evidence behind the Country Index.
        </p>
        <Skel className="mt-4 h-3.5 w-72 max-w-full" />
      </header>
      {[[100, 96, 88, 54], [100, 94, 70], [100, 98, 90, 82, 40]].map((lines, i) => (
        <div key={i} className="grid gap-x-12 gap-y-4 border-b border-line py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Skel className="h-5 w-40" />
          <SkelText className="max-w-[72ch]" widths={lines} line="h-3.5" />
        </div>
      ))}
    </Loading>
  );
}
