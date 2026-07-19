import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { getStateCounts, getStats, getUpdates } from "@/lib/api";
import { STATES, stateByCode } from "@/lib/states";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TRENDING = [
  { label: "USDOT 54283 → Swift Transportation", href: "/search?q=54283" },
  { label: "USDOT 86876 → FedEx", href: "/search?q=86876" },
  { label: "J.B. Hunt Transport", href: "/search?q=jb hunt transport" },
  { label: '"trucking companies in Texas"', href: "/state/tx" },
  { label: "Werner Enterprises", href: "/search?q=werner enterprises" },
];

const FAQS = [
  {
    q: "What is a USDOT number?",
    a: "A USDOT number is a unique identifier the Federal Motor Carrier Safety Administration (FMCSA) assigns to companies that operate commercial vehicles in the United States. It is used to track a carrier's registration, inspections, crashes, and safety record.",
  },
  {
    q: "How do I read BASIC safety measures?",
    a: "FMCSA groups safety data into BASIC categories: Unsafe Driving, HOS Compliance, Driver Fitness, Controlled Substances, and Vehicle Maintenance. Each gets an SMS measure — lower is better — and an alert flag when the carrier crosses FMCSA's intervention threshold. Public percentiles were discontinued by the FAST Act, so CarrierCheck shows the raw measures.",
  },
  {
    q: "What does a Satisfactory rating mean?",
    a: "Satisfactory is the best of the three FMCSA safety ratings, meaning a compliance review found the carrier meets the safety fitness standard. Conditional means some requirements are not met; Unsatisfactory means serious non-compliance. Most carriers have never been reviewed and are unrated.",
  },
  {
    q: "How often is the data updated?",
    a: "Carrier registrations come from the monthly FMCSA census file, and safety data (BASIC measures, inspections, violations) comes from the monthly SMS snapshot covering a rolling 24-month window. CarrierCheck refreshes as FMCSA publishes new files.",
  },
];

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export default async function HomePage() {
  const [stats, states, updates] = await Promise.all([
    getStats(),
    getStateCounts(),
    getUpdates(),
  ]);

  const alertPct =
    stats && stats.scored_carriers > 0
      ? Math.round((stats.carriers_with_alerts / stats.scored_carriers) * 100)
      : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "CarrierCheck",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={query}` },
        "query-input": "required name=query",
      },
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

  const fmt = (n: number | undefined | null, fallback: string) =>
    typeof n === "number" ? n.toLocaleString() : fallback;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO */}
      <section className="py-12 text-center sm:py-16">
        <h1 className="font-heading mx-auto max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          FMCSA Carrier Safety Directory
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600 sm:text-lg">
          Search any US motor carrier by USDOT, MC number, or company name.
        </p>
        <div className="mx-auto mt-6 w-full max-w-2xl px-2">
          <SearchBar />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {fmt(stats?.total_carriers, "2.2M+")} carriers ·{" "}
          {fmt(stats?.total_safety_scores, "1.8M+")} safety scores ·{" "}
          {fmt(stats?.total_inspections, "5.7M+")} inspections · Updated weekly
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
          How it works
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <IconSearch />,
              title: "1. Search",
              text: "Enter a USDOT number, MC number, or company name — 2.2M carriers indexed.",
            },
            {
              icon: <IconShield />,
              title: "2. Review",
              text: "See BASIC safety measures, 24-month inspection history, and violations.",
            },
            {
              icon: <IconBell />,
              title: "3. Act",
              text: "Vet the carrier, share the profile, and get alerts when their record changes (soon).",
            },
          ].map((s) => (
            <div key={s.title} className="rounded-lg border bg-white p-5">
              <div className="text-sky-700">{s.icon}</div>
              <h3 className="font-heading mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BROWSE BY STATE */}
      <section id="states" className="mt-12 scroll-mt-20">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
          Browse by state
        </h2>
        {states && states.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {states.slice(0, 10).map((s) => (
                <Link
                  key={s.state}
                  href={`/state/${s.state.toLowerCase()}`}
                  className="rounded-lg border bg-white p-4 transition hover:border-sky-500 hover:shadow-sm"
                >
                  <div className="font-heading text-lg font-bold text-slate-900">{s.state}</div>
                  <div className="text-sm text-slate-500">
                    {s.count.toLocaleString()} carriers
                  </div>
                  <div className="text-xs text-slate-400">
                    {stateByCode(s.state)?.name}
                  </div>
                </Link>
              ))}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-sky-700">
                All states & territories
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {STATES.map((s) => (
                  <Link
                    key={s.code}
                    href={`/state/${s.code.toLowerCase()}`}
                    className="rounded-full border bg-white px-3 py-1 text-sm text-slate-600 hover:border-sky-500 hover:text-sky-700"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {STATES.map((s) => (
              <Link
                key={s.code}
                href={`/state/${s.code.toLowerCase()}`}
                className="rounded-full border bg-white px-3 py-1 text-sm text-slate-600 hover:border-sky-500 hover:text-sky-700"
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {/* TRENDING SEARCHES */}
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
            Trending searches
          </h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {TRENDING.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="text-sky-700 hover:underline">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* SAFETY ALERTS DISTRIBUTION */}
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
            Safety alerts overview
          </h2>
          {stats && alertPct !== null ? (
            <div className="mt-3">
              <p className="text-sm text-slate-600">
                Of {stats.scored_carriers.toLocaleString()} carriers with SMS safety scores:
              </p>
              <div className="mt-3 grid gap-3 text-sm">
                <div>
                  <div className="flex justify-between">
                    <span>No BASIC alerts</span>
                    <span className="font-semibold">{100 - alertPct}%</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-green-500"
                      style={{ width: `${100 - alertPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span>1+ BASIC alert</span>
                    <span className="font-semibold">{alertPct}%</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-red-500"
                      style={{ width: `${Math.max(alertPct, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                FMCSA discontinued public safety-rating percentiles; alert flags shown instead.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading safety statistics…</p>
          )}
        </section>
      </div>

      {/* LATEST FMCSA UPDATES */}
      <section className="mt-6 rounded-lg border bg-white p-5">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
          Latest FMCSA updates
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <li>
            <span className="font-heading text-xl font-bold text-sky-700">
              {fmt(updates?.new_carriers_this_week, "—")}
            </span>
            <br />
            new carriers registered this week
          </li>
          <li>
            <span className="font-heading text-xl font-bold text-sky-700">
              {fmt(updates?.inspections_last_month, "—")}
            </span>
            <br />
            inspections recorded in {updates?.inspections_month ?? "the latest month"}
          </li>
          <li>
            <span className="font-heading text-xl font-bold text-sky-700">
              {fmt(stats?.total_violations, "—")}
            </span>
            <br />
            violations on record (24-month window)
          </li>
        </ul>
      </section>

      {/* CTA ROW */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h3 className="font-heading font-semibold">Safety alerts</h3>
          <p className="mt-1 text-sm text-slate-600">
            Get notified when a carrier&apos;s safety record changes.
          </p>
          <span className="mt-3 inline-block rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
            Coming soon
          </span>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <h3 className="font-heading font-semibold">API access</h3>
          <p className="mt-1 text-sm text-slate-600">
            Query carriers, safety scores, and inspections programmatically.
          </p>
          <a
            href={`${API_URL}/docs`}
            className="mt-3 inline-block rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Explore the API
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
          Frequently asked questions
        </h2>
        <div className="mt-3 grid gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="rounded-lg border bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
