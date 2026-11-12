import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { NAV_SCRIPT } from "@/components/admin/navState";

const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], display: "swap" });

const showSampleBanner = process.env.SHOW_SAMPLE_DATA_BANNER !== "false";

export const metadata: Metadata = {
  title: { default: "Country Index", template: "%s · Country Index" },
  description: "Country scores across five pillars, with the rationale and sources behind each score.",
  // noindex while the data is placeholder (CONTEXT §7)
  robots: showSampleBanner ? { index: false, follow: false } : undefined,
};

// Runs before first paint so the saved theme never flashes. Falls back to the
// visitor's system setting. Storage can throw (private mode) — default to light.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* admin sidebar collapsed state (harmless on public pages: only sets an attribute) */}
        <script dangerouslySetInnerHTML={{ __html: NAV_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
