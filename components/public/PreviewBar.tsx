import { previewState } from "@/lib/preview";
import { exitPreview, exitSharedPreview } from "@/lib/preview-actions";
import { fmtPeriod } from "@/lib/admin/format";
import { versionLabel } from "@/lib/admin/types";

/** Across the top of every public page while a version is previewed — by an administrator,
 *  or by a reviewer through a share link: which version, that it is not live, and the way
 *  out. Nothing renders for anyone else (and nothing at build time, when Draft Mode is
 *  always off). */
export async function PreviewBar() {
  const p = await previewState();
  if (!p) return null;
  if (p.kind === "share") {
    return (
      <div role="status" className="preview-bar">
        <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <span className="preview-tag">Preview</span>
            <strong className="font-semibold">{p.label}</strong>
            <span className="opacity-80"> — not published. Shared for review only; please don’t forward this link.</span>
          </p>
          <form action={exitSharedPreview}><button type="submit" className="preview-btn is-solid">Exit preview</button></form>
        </div>
      </div>
    );
  }
  const v = p.version;
  const note = p.demo
    ? "Demonstration record: shown with the bundled sample dataset."
    : !p.payloadFound ? "This version’s data couldn’t be loaded — showing the published data." : null;
  return (
    <div role="status" className="preview-bar">
      <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
          <span className="preview-tag">Preview</span>
          <strong className="font-semibold">{versionLabel(v)} · {fmtPeriod(v.as_of)}</strong>
          <span className="opacity-80"> — {v.status === "published" ? "this is the live version" : "not live"}. Only you can see this.</span>
          {note && <span className="block text-[12.5px] opacity-75 sm:ml-1 sm:inline">{note}</span>}
        </p>
        <div className="flex items-center gap-2">
          <a href={`/admin/versions/${v.id}`} className="preview-btn">Back to admin</a>
          <form action={exitPreview}><input type="hidden" name="id" value={v.id} /><button type="submit" className="preview-btn is-solid">Exit preview</button></form>
        </div>
      </div>
    </div>
  );
}
