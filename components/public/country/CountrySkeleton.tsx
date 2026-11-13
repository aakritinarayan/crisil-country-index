import { Loading, Skel, SkelText } from "@/components/ui/Skeleton";

/* The country profile while it renders on demand (a version in preview, a country added
 * since the last build): the same compact dark header and sections, so nothing jumps. */
export function CountrySkeleton() {
  return (
    <Loading label="Loading country profile">
      <div className="country-hero skel-on-dark">
        <div aria-hidden className="country-hero-grid" />
        <div className="wrap relative grid gap-8 py-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12 lg:py-10">
          <div className="min-w-0">
            <Skel className="h-3.5 w-48" />
            <div className="mt-5 flex items-center gap-3.5"><Skel className="h-8 w-11 rounded-[5px]" /><Skel className="h-10 w-64 max-w-[70%]" /></div>
            <Skel className="mt-3 h-3.5 w-56" />
            <div className="mt-6 flex flex-wrap items-end gap-x-9 gap-y-4">
              <div><Skel className="h-3 w-24" /><Skel className="mt-2 h-10 w-36" /></div>
              <div><Skel className="h-3 w-20" /><Skel className="mt-2 h-7 w-20" /></div>
              <div><Skel className="h-3 w-20" /><Skel className="mt-2 h-7 w-16" /></div>
            </div>
            <SkelText className="mt-5 max-w-[64ch]" widths={[100, 72]} line="h-3.5" />
            <Skel className="mt-6 h-11 w-36" />
          </div>
          <div className="mx-auto hidden aspect-square w-full max-w-[340px] place-items-center md:grid lg:-my-6 lg:max-w-none">
            <Skel className="size-[62%] rounded-full" />
          </div>
        </div>
      </div>
      <div className="wrap">
        <div className="py-10">
          <Skel className="h-6 w-48" /><Skel className="mt-2 h-3.5 w-72 max-w-full" />
          <Skel className="mt-6 h-16 w-full rounded-[6px]" />
        </div>
        <div className="border-t border-line py-10">
          <Skel className="h-6 w-56" />
          <div className="mt-6 grid gap-4">
            {[86, 72, 64, 58].map((w) => (
              <div key={w} className="grid grid-cols-[minmax(0,220px)_1fr_56px] items-center gap-4">
                <Skel className="h-4 w-[80%]" /><Skel className="h-3 rounded-full" style={{ width: `${w}%` }} /><Skel className="h-7 w-14" />
              </div>
            ))}
          </div>
          <SkelText className="mt-8 max-w-[70ch]" widths={[100, 97, 88, 60]} />
        </div>
      </div>
    </Loading>
  );
}
