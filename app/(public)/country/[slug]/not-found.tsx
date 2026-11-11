import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";

/** Unknown slug: the country is not in the published index (renamed, removed, or mistyped). */
export default function CountryNotFound() {
  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <p className="eyebrow">Country not found</p>
        <h1 className="t-h2 mt-3 text-ink">We couldn&apos;t find that <span className="grad-text">country</span></h1>
        <p className="t-lead mx-auto mt-4 max-w-[52ch] text-muted">It may not be part of the current edition, or the link may be mistyped. Search from the header, or browse the full list.</p>
        <div className="mt-8 flex justify-center">
          <Link href="/#map" className="btn">Explore countries<span className="box"><ArrowLeft size={16} /></span></Link>
        </div>
      </div>
    </section>
  );
}
