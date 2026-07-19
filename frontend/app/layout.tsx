import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Space_Mono } from "next/font/google";
import Link from "next/link";
import Stripe from "@/components/Stripe";
import "./globals.css";

const heading = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  axes: ["opsz"],
});
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

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
    <html lang="en" className={`${heading.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-stone-50 font-sans text-zinc-900 antialiased">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-heading text-xl font-bold tracking-tight">
              Carrier<span className="text-red-600">Check</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-zinc-600">
              <Link href="/#states" className="hidden hover:text-zinc-900 sm:block">
                States
              </Link>
              <Link href="/blog" className="hover:text-zinc-900">
                Blog
              </Link>
              <Link
                href="/search"
                className="rounded-full bg-zinc-900 px-4 py-1.5 font-semibold text-white transition hover:bg-zinc-700"
              >
                Search the directory
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-12">{children}</main>
        <Stripe />
        <footer className="bg-zinc-950 py-10 text-center text-sm text-zinc-400">
          <p className="font-heading text-lg font-bold text-white">
            Carrier<span className="text-red-500">Check</span>
          </p>
          <p className="mx-auto mt-3 max-w-xl px-4">
            Data sourced from public FMCSA records. CarrierCheck is not affiliated with the
            FMCSA or US DOT.
          </p>
        </footer>
      </body>
    </html>
  );
}
