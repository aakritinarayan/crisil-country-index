"use client";
import { useActionState, useRef } from "react";
import { Check, Publish, Restore } from "@/components/ui/icons";
import { approve, publish } from "@/app/(admin)/admin/(console)/versions/[id]/actions";

type Mode = "publish" | "republish" | "approve";
const COPY = {
  publish: { verb: "Publish", busy: "Publishing", icon: Publish },
  republish: { verb: "Publish again", busy: "Publishing", icon: Restore },
  approve: { verb: "Approve", busy: "Approving", icon: Check },
} as const;

/** Publish, publish an earlier version again, or approve — each behind a confirmation step
 *  that says what happens, deliberately heavier than Preview (FLOW §2). `local` says that
 *  this console writes to a local store, so nothing reads as a production operation. */
export function PublishControl({ id, mode, title, replaces, changes, local }: { id: string; mode: Mode; title: string; replaces: string | null; changes: string | null; local: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, dispatch, pending] = useActionState(mode === "approve" ? approve : publish, null);
  const { verb, busy, icon: Icon } = COPY[mode];
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`act-btn ${mode === "republish" ? "" : "is-primary"}`}><Icon size={16} />{verb}…</button>
      <dialog ref={dialog} aria-labelledby={`${mode}-${id}`} className="confirm-dialog" onClick={(e) => { if (e.target === e.currentTarget && !pending) dialog.current?.close(); }}>
        <form action={dispatch} className="p-6">
          <input type="hidden" name="id" value={id} />
          <h2 id={`${mode}-${id}`} className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{verb} {title}?</h2>
          {mode === "approve" ? (
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
              You confirm you have reviewed its validation report and changes. Approval is recorded under your name; it doesn’t publish — that remains a separate step.
            </p>
          ) : (
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
              It becomes the live version of the public site{replaces ? <>, replacing <strong className="font-semibold text-ink">{replaces}</strong>, which is kept</> : ""}.
              {mode === "republish" && " This is an earlier version, so publishing it rolls the site back."}
            </p>
          )}
          {changes && mode !== "republish" && <p className="mt-3 rounded-[4px] bg-sunken px-3 py-2 text-[13.5px] text-ink-2">{changes}</p>}
          {local && <p className="mt-3 text-[13px] text-muted">Prototype: this is recorded in the local store on this machine, not a production system.</p>}
          {error && <p role="alert" className="admin-error mt-3">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} disabled={pending} className="act-btn">Cancel</button>
            <button type="submit" disabled={pending} className="act-btn is-primary">{pending ? `${busy}…` : `${verb} now`}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
