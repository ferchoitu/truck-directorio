import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "What is a USDOT Number? Complete Guide",
  description:
    "A USDOT number is the FMCSA's unique identifier for commercial vehicle operators. Learn who needs one, how it differs from an MC number, and how to look one up.",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const FAQS = [
  {
    q: "Who needs a USDOT number?",
    a: "Companies operating commercial vehicles over 10,000 lbs in interstate commerce, hauling hazardous materials, or transporting 9+ passengers for compensation must register for a USDOT number. Many states also require one for intrastate operations.",
  },
  {
    q: "Is a USDOT number the same as an MC number?",
    a: "No. The USDOT number identifies a carrier for safety monitoring; the MC (operating authority) number authorizes a company to transport regulated commodities or passengers for hire across state lines. For-hire interstate carriers typically need both.",
  },
  {
    q: "How do I look up a USDOT number?",
    a: "Search the carrier's name or number on CarrierCheck or the FMCSA SAFER system. The record shows the company's legal name, address, fleet size, safety data, inspections, and violations.",
  },
  {
    q: "Does a USDOT number expire?",
    a: "The number itself doesn't expire, but carriers must update their MCS-150 registration information at least every two years, and operating authority can be revoked for non-compliance or lapsed insurance.",
  },
];

export default function Article() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "What is a USDOT Number? Complete Guide",
      datePublished: "2026-07-19",
      author: { "@type": "Organization", name: "CarrierCheck" },
      publisher: { "@type": "Organization", name: "CarrierCheck", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <article className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-zinc-900">Home</Link>
        {" / "}
        <Link href="/blog" className="hover:text-zinc-900">Blog</Link>
        {" / "}
        <span>What is a USDOT number?</span>
      </nav>

      <h1 className="font-heading mt-3 text-3xl font-bold">What is a USDOT number?</h1>

      <p className="mt-4 text-lg text-slate-700">
        A USDOT number is a unique identifier assigned by the Federal Motor Carrier Safety
        Administration (FMCSA) to companies operating commercial vehicles in the United
        States. It links a carrier to its registration details, inspection history, crash
        records, and safety performance data.
      </p>

      <h2 className="font-heading mt-8 text-xl font-semibold">USDOT vs MC vs MX numbers</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Purpose</th>
              <th className="px-4 py-2">Who needs it</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-4 py-2 font-medium">USDOT</td>
              <td className="px-4 py-2">Safety monitoring and registration identity</td>
              <td className="px-4 py-2">Nearly all interstate commercial operators</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-2 font-medium">MC</td>
              <td className="px-4 py-2">Operating authority for for-hire transport</td>
              <td className="px-4 py-2">For-hire carriers of regulated commodities or passengers</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">MX</td>
              <td className="px-4 py-2">Operating authority for Mexico-domiciled carriers</td>
              <td className="px-4 py-2">Mexican carriers operating in the US</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-heading mt-8 text-xl font-semibold">
        What a USDOT record tells you
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
        <li>Legal name, DBA, and physical address of the company</li>
        <li>Fleet size (power units) and number of drivers</li>
        <li>Operation type: interstate or intrastate, for-hire or private</li>
        <li>SMS BASIC safety measures across five categories</li>
        <li>Roadside inspection history for the last 24 months</li>
        <li>Recorded violations with severity and out-of-service flags</li>
      </ol>

      <div className="mt-8 rounded-2xl bg-white shadow-sm p-5">
        <h2 className="font-heading text-lg font-semibold">Look up any carrier now</h2>
        <p className="mt-1 text-sm text-slate-600">
          Search 2.2M+ FMCSA-registered carriers by USDOT, MC, or company name — free.
        </p>
        <Link
          href="/search"
          className="mt-3 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Search the directory
        </Link>
      </div>

      <h2 className="font-heading mt-8 text-xl font-semibold">Frequently asked questions</h2>
      <div className="mt-3 grid gap-3">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-2xl bg-white shadow-sm p-4">
            <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
            <p className="mt-2 text-sm text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </article>
  );
}
