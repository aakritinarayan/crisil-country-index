"use client";
import { useActionState, useRef } from "react";
import { Publish, Restore } from "@/components/ui/icons";
import { publish } from "@/app/(admin)/admin/(console)/versions/[id]/actions";

/** Publish (or Restore) with a confirmation step: what goes live, what it replaces, and what
 *  changes — deliberately a different, heavier action than Preview (FLOW §2). */
export function PublishControl({ id, restore, title, replaces, changes }: { id: string; restore: boolean; title: string; replaces: string | null; changes: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, dispatch, pending] = useActionState(publish, null);
  const verb = restore ? "Restore" : "Publish";
  const Icon = restore ? Restore : Publish;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`act-btn ${restore ? "" : "is-primary"}`}><Icon size={16} />{verb}…</button>
      <dialog ref={dialog} aria-labelledby={`pub-${id}`} className="confirm-dialog" onClick={(e) => { if (e.target === e.currentTarget && !pending) dialog.current?.close(); }}>
        <form action={dispatch} className="p-6">
          <input type="hidden" name="id" value={id} />
          <h2 id={`pub-${id}`} className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{verb} {title}?</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
            It becomes the live version of the public site{replaces ? <>, replacing <strong className="font-semibold text-ink">{replaces}</strong>, which is kept and can be restored</> : ""}. Visitors see it within seconds.
          </p>
          {changes && <p className="mt-3 rounded-[4px] bg-sunken px-3 py-2 text-[13.5px] text-ink-2">{changes}</p>}
          {error && <p role="alert" className="admin-error mt-3">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} disabled={pending} className="act-btn">Cancel</button>
            <button type="submit" disabled={pending} className="act-btn is-primary">{pending ? `${verb === "Publish" ? "Publishing" : "Restoring"}…` : `${verb} now`}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
