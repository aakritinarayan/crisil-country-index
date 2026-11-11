"use client";
import { useState } from "react";
import { ArrowUpRight } from "@/components/ui/icons";

/** Share profile: the device share sheet where there is one, otherwise copy the
 *  canonical profile URL (no hash or query). */
export function ShareButton({ title, path, className = "hero-btn hero-btn-ghost gap-3" }: { title: string; path: string; className?: string }) {
  const [status, setStatus] = useState<"" | "copied" | "failed">("");
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* dismissed: fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(url); setStatus("copied"); } catch { setStatus("failed"); }
    setTimeout(() => setStatus(""), 4000);
  };
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={share} className={className}>Share profile<ArrowUpRight size={16} /></button>
      <span role="status" className="absolute left-0 top-full mt-1.5 whitespace-nowrap text-[12.5px] text-[rgb(232_239_236/0.7)]">
        {status === "copied" && "Link copied."}
        {status === "failed" && "Could not copy. Use the address bar."}
      </span>
    </span>
  );
}
