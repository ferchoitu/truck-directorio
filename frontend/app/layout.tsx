import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const heading = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  axes: ["opsz"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

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
      <body className="min-h-screen bg-[#f4f5f2] font-sans text-zinc-900 antialiased">
        <header className="sticky top-3 z-30 px-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-zinc-200/70 bg-white/85 py-2 pl-5 pr-2 shadow-sm backdrop-blur">
            <Link href="/" className="font-heading text-lg font-bold tracking-tight">
              Carrier<span className="italic text-lime-600">Check</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600 sm:gap-5">
              <Link href="/#states" className="hidden hover:text-zinc-900 sm:block">
                States
              </Link>
              <Link href="/api-access" className="hidden hover:text-zinc-900 sm:block">
                API
              </Link>
              <Link href="/blog" className="hover:text-zinc-900">
                Blog
              </Link>
              <Link
                href="/search"
                className="rounded-full bg-zinc-950 px-4 py-2 font-semibold text-white transition hover:bg-zinc-700"
              >
                Search
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 pb-6 pt-6 sm:px-4">{children}</main>
        <footer className="px-3 pb-3 sm:px-4">
          <div className="mx-auto max-w-6xl rounded-3xl bg-zinc-950 px-6 py-12 text-center text-sm text-zinc-400">
            <p className="font-heading text-2xl font-semibold text-white">
              Carrier<span className="italic text-lime-300">Check</span>
            </p>
            <p className="mx-auto mt-3 max-w-xl">
              Data sourced from public FMCSA records. CarrierCheck is not affiliated with
              the FMCSA or US DOT.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-zinc-300">
              <Link href="/search" className="hover:text-lime-300">Search</Link>
              <Link href="/#states" className="hover:text-lime-300">States</Link>
              <Link href="/api-access" className="hover:text-lime-300">API</Link>
              <Link href="/blog" className="hover:text-lime-300">Blog</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
