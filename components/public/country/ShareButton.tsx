"use client";
import { useState } from "react";
import { ArrowUpRight } from "@/components/ui/icons";

/** Share profile: the device share sheet where there is one, otherwise copy the link. */
export function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState<"" | "copied" | "failed">("");
  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* dismissed: fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus(""), 4000);
  };
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button type="button" onClick={share} className="btn btn-outline">Share profile<span className="box"><ArrowUpRight size={16} /></span></button>
      <p role="status" className="min-h-5 text-[13px] text-muted">
        {status === "copied" && "Link copied to clipboard."}
        {status === "failed" && "Could not copy. Copy the address from your browser bar."}
      </p>
    </div>
  );
}
