import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — FMCSA Data Guides",
  description:
    "Guides to understanding FMCSA data: USDOT numbers, safety ratings, BASIC scores, and how to vet trucking companies.",
};

const POSTS = [
  {
    slug: "what-is-usdot-number",
    title: "What is a USDOT number?",
    excerpt:
      "What USDOT numbers are, who needs one, and how they differ from MC numbers — with lookup instructions.",
    date: "2026-07-19",
  },
];

export default function BlogIndex() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading text-3xl font-bold">FMCSA data guides</h1>
      <p className="mt-2 text-slate-600">
        Plain-English guides to USDOT registrations, safety scores, and carrier vetting.
      </p>
      <div className="mt-8 grid gap-4">
        {POSTS.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="rounded-lg border bg-white p-5 transition hover:border-sky-500 hover:shadow-sm"
          >
            <h2 className="font-heading text-lg font-semibold text-sky-700">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.excerpt}</p>
            <p className="mt-2 text-xs text-slate-400">{p.date}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500">
        More guides coming soon: FMCSA safety ratings explained, BASIC scores complete guide,
        and how to vet a trucking company.
      </p>
    </div>
  );
}
