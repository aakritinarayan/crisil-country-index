"use client";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSheet, UploadIcon } from "@/components/ui/icons";
import { uploadWorkbook } from "./actions";

type Phase = { step: "idle" } | { step: "uploading"; pct: number } | { step: "checking" } | { step: "opening" };

/** Choose a workbook and upload it. With scripts, the file goes up with real progress
 *  (XMLHttpRequest to ./submit), then a separate state while the server validates it, then
 *  the version page. Without scripts the form falls back to the server action. The chosen
 *  file stays named throughout; problems with the file come back as a message. */
export function UploadForm() {
  const [actionError, dispatch, actionPending] = useActionState(uploadWorkbook, null);
  const [name, setName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const busy = phase.step !== "idle" || actionPending;
  const message = error ?? actionError;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    const file = input.current?.files?.[0];
    if (!file || busy) { e.preventDefault(); return; }
    e.preventDefault();
    setError(null);
    setPhase({ step: "uploading", pct: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/admin/upload/submit");
    xhr.responseType = "json";
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setPhase({ step: "uploading", pct: Math.round((ev.loaded / ev.total) * 100) }); };
    xhr.upload.onload = () => setPhase({ step: "checking" });             // the file has arrived; the server is reading it
    xhr.onload = () => {
      const body = xhr.response as { url?: string; error?: string } | null;
      if (xhr.status === 200 && body?.url) { setPhase({ step: "opening" }); router.push(body.url); return; }
      setPhase({ step: "idle" });
      // middleware sends an expired session to the sign-in page
      if (xhr.responseURL.includes("/admin/login")) { setError("Your session has expired. Sign in again (in a new tab, to keep this page), then upload the file."); return; }
      setError(body?.error ?? "The upload didn’t complete. Nothing was saved. Try again.");
    };
    xhr.onerror = xhr.ontimeout = () => { setPhase({ step: "idle" }); setError("The connection dropped during the upload. Nothing was saved. Try again."); };
    const data = new FormData();
    data.set("file", file);
    xhr.send(data);
  };

  return (
    <form action={dispatch} onSubmit={submit} className="grid gap-4" aria-busy={busy || undefined}>
      <label className={`drop-zone ${busy ? "is-busy" : "is-live"} ${name ? "has-file" : ""}`}>
        <FileSheet size={28} />
        <span className="mt-3 text-[15px] font-semibold text-ink">{name ?? "Choose the workbook to upload"}</span>
        <span className="mt-1 text-[13.5px] text-muted">{busy ? "Working on this file…" : name ? "Choose another file to replace it" : ".xlsx from the Country Index template · up to 4 MB"}</span>
        <input ref={input} type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="sr-only" disabled={busy}
          onChange={(e) => { setName(e.currentTarget.files?.[0]?.name ?? null); setError(null); }} aria-describedby={message ? "upload-error" : undefined} />
      </label>

      {phase.step !== "idle" && <Progress phase={phase} />}
      {message && !busy && <p id="upload-error" role="alert" className="admin-error">{message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !name} className="act-btn is-primary !h-10 disabled:cursor-not-allowed disabled:opacity-50">
          <UploadIcon size={16} />{busy ? "Working…" : "Upload and validate"}
        </button>
        <span className="text-[13px] text-muted">Nothing changes on the public site until a version is published.</span>
      </div>
    </form>
  );
}

/** Three honest steps: the upload (real percentage), the check (no percentage — the server
 *  doesn't report one), then opening the results. */
function Progress({ phase }: { phase: Exclude<Phase, { step: "idle" }> }) {
  const at = { uploading: 0, checking: 1, opening: 2 }[phase.step];
  const steps = [
    phase.step === "uploading" ? `Uploading · ${phase.pct}%` : "Uploaded",
    at < 1 ? "Check every tab, row and column" : at === 1 ? "Checking every tab, row and column…" : "Checked",
    at < 2 ? "Open the results" : "Opening the results…",
  ];
  return (
    <div className="upload-progress">
      <p role="status" aria-live="polite" className="sr-only">{steps[at]}</p>
      <ol aria-hidden className="grid gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className={`up-step ${i < at ? "is-done" : i === at ? "is-now" : ""}`}>
            <span className="up-dot" />{s}
          </li>
        ))}
      </ol>
      {phase.step === "uploading"
        ? <progress className="up-bar" max={100} value={phase.pct} aria-label="Upload progress" />
        : <progress className="up-bar" aria-label={phase.step === "checking" ? "Validating the workbook" : "Opening the results"} />}
    </div>
  );
}
