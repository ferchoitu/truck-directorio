import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const heading = Lexend({ subsets: ["latin"], variable: "--font-heading" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CarrierCheck — FMCSA Carrier Safety Directory",
    template: "%s | CarrierCheck",
  },
  description:
    "Look up any US motor carrier by USDOT or MC number. Safety data, BASIC measures, inspections and violations from public FMCSA records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-heading text-xl font-bold text-slate-900">
              Carrier<span className="text-sky-700">Check</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/search" className="hover:text-sky-700">
                Search
              </Link>
              <Link href="/#states" className="hover:text-sky-700">
                States
              </Link>
              <Link href="/blog" className="hover:text-sky-700">
                Blog
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
