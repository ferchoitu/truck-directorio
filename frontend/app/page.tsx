import Link from "next/link";
import CarrierCard from "@/components/CarrierCard";
import SearchBar from "@/components/SearchBar";
import { getStats, getTopCarriers } from "@/lib/api";
import { STATES } from "@/lib/states";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const POPULAR_SEARCHES = [
  { label: "Swift Transportation", q: "swift transportation" },
  { label: "J.B. Hunt", q: "jb hunt" },
  { label: "FedEx", q: "federal express" },
  { label: "Werner Enterprises", q: "werner enterprises" },
  { label: "Schneider National", q: "schneider national" },
];

const OPERATION_TYPES = ["Interstate", "Intrastate Hazmat", "Intrastate Non-Hazmat"];
const RATINGS = ["Satisfactory", "Conditional", "Unsatisfactory"];

export default async function HomePage() {
  const [stats, topCarriers] = await Promise.all([getStats(), getTopCarriers(5)]);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CarrierCheck",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={query}` },
      "query-input": "required name=query",
    },
  };

  return (
    <div className="flex flex-col items-center">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      <section className="w-full py-12 text-center sm:py-16">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Look up any US trucking company&apos;s safety record
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Search by USDOT number, MC number, or company name. Safety data, inspections, and
          violations from public FMCSA records.
        </p>
        <div className="mx-auto mt-6 w-full max-w-2xl px-2">
          <SearchBar />
          <p className="mt-2 text-sm text-slate-500">
            {stats ? `${stats.total_carriers.toLocaleString()} carriers` : "2.2M+ carriers"} ·
            Updated weekly · Free
          </p>
        </div>

        <form
          action="/search"
          method="GET"
          className="mx-auto mt-6 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 px-2 text-sm"
        >
          <span className="text-slate-500">Or browse by:</span>
          <select name="state" className="rounded-lg border bg-white px-2 py-1.5" defaultValue="">
            <option value="">State</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="operation_type" className="rounded-lg border bg-white px-2 py-1.5" defaultValue="">
            <option value="">Type</option>
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="safety_rating" className="rounded-lg border bg-white px-2 py-1.5" defaultValue="">
            <option value="">Rating</option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-semibold text-white hover:bg-slate-900"
          >
            Browse
          </button>
        </form>
      </section>

      <section className="grid w-full gap-6 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            📊 Popular searches
          </h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {POPULAR_SEARCHES.map((p) => (
              <li key={p.q}>
                <Link
                  href={`/search?q=${encodeURIComponent(p.q)}`}
                  className="text-blue-700 hover:underline"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            🚛 In the database
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[
              [stats?.total_carriers, "Active carriers"],
              [stats?.total_inspections, "Inspections (24 mo)"],
              [stats?.total_violations, "Violations (24 mo)"],
              [stats?.states, "States & territories"],
            ].map(([value, label]) => (
              <div key={String(label)}>
                <dt className="text-xl font-bold text-blue-700">
                  {typeof value === "number" ? value.toLocaleString() : "—"}
                </dt>
                <dd className="text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {topCarriers && topCarriers.length > 0 && (
        <section className="mt-10 w-full">
          <h2 className="text-lg font-semibold">🏆 Largest fleets</h2>
          <div className="mt-3 grid gap-3">
            {topCarriers.map((c) => (
              <CarrierCard key={c.usdot_number} carrier={c} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 w-full">
        <h2 className="text-lg font-semibold">Browse carriers by state</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {STATES.map((s) => (
            <Link
              key={s.code}
              href={`/state/${s.code.toLowerCase()}`}
              className="rounded-full border bg-white px-3 py-1 text-sm text-slate-600 hover:border-blue-500 hover:text-blue-700"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
