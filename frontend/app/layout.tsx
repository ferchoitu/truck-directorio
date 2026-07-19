import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CarrierCheck — FMCSA Carrier Lookup & Safety Records",
    template: "%s | CarrierCheck",
  },
  description:
    "Look up any US motor carrier by USDOT or MC number. Safety ratings, BASIC scores, inspections and violations from public FMCSA data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold text-blue-700">
              Carrier<span className="text-slate-900">Check</span>
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-slate-600">
              <Link href="/search" className="hover:text-blue-700">
                Search
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t bg-white py-8 text-center text-sm text-slate-500">
          <p>
            Data sourced from public FMCSA records. CarrierCheck is not affiliated with the
            FMCSA or US DOT.
          </p>
        </footer>
      </body>
    </html>
  );
}
