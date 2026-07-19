import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import SectionLabel from "@/components/SectionLabel";
import Stripe from "@/components/Stripe";
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
    <div className="-mx-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO — black, editorial serif */}
      <section className="bg-zinc-950 px-4 pb-14 pt-14 text-white sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-heading max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Built for the loads that can&apos;t ride with an unvetted carrier.
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300 sm:text-lg">
            CarrierCheck is the FMCSA safety directory: registration, BASIC measures,
            24-month inspections, and violations for every active US motor carrier — in one
            search.
          </p>
          <div className="mt-8 max-w-2xl">
            <SearchBar dark />
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-widest text-zinc-400">
            {fmt(stats?.total_carriers, "2.2M+")} carriers ·{" "}
            {fmt(stats?.total_safety_scores, "1.8M+")} safety scores ·{" "}
            {fmt(stats?.total_inspections, "5.7M+")} inspections · updated weekly
          </p>
        </div>
      </section>
      <Stripe />

      <div className="mx-auto max-w-6xl px-4">
        {/* STATEMENT */}
        <section className="py-14 sm:py-20">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="font-heading mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
            Most lookups show one number. Vetting a carrier needs the full record.
          </h2>
          <p className="mt-4 max-w-2xl text-zinc-600">
            Registration status alone won&apos;t tell you if a carrier keeps its trucks on the
            road. CarrierCheck joins the FMCSA census with the complete SMS safety file —
            measures, inspections, and violations — so the whole picture is one search away.
          </p>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-dashed border-zinc-300 py-12">
          <SectionLabel>How it works</SectionLabel>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Search",
                text: "Enter a USDOT number, MC number, or company name — 2.2M carriers indexed.",
              },
              {
                n: "02",
                title: "Review",
                text: "BASIC safety measures, 24-month inspection history, and every recorded violation.",
              },
              {
                n: "03",
                title: "Act",
                text: "Vet the carrier, share the profile, and get alerts when their record changes (soon).",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-sm border border-dashed border-zinc-300 bg-white p-5">
                <p className="font-mono text-xs font-bold text-red-600">{s.n}</p>
                <h3 className="font-heading mt-2 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BROWSE BY STATE */}
        <section id="states" className="scroll-mt-20 border-t border-dashed border-zinc-300 py-12">
          <SectionLabel>Browse by state</SectionLabel>
          {states && states.length > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {states.slice(0, 10).map((s) => (
                  <Link
                    key={s.state}
                    href={`/state/${s.state.toLowerCase()}`}
                    className="group rounded-sm border border-dashed border-zinc-300 bg-white p-4 transition hover:border-solid hover:border-red-600"
                  >
                    <div className="font-heading text-2xl font-semibold group-hover:text-red-600">
                      {s.state}
                    </div>
                    <div className="font-mono text-xs text-zinc-500">
                      {s.count.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {stateByCode(s.state)?.name}
                    </div>
                  </Link>
                ))}
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer font-mono text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-red-600">
                  All states & territories ↓
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {STATES.map((s) => (
                    <Link
                      key={s.code}
                      href={`/state/${s.code.toLowerCase()}`}
                      className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-600 hover:border-red-600 hover:text-red-600"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {STATES.map((s) => (
                <Link
                  key={s.code}
                  href={`/state/${s.code.toLowerCase()}`}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-600 hover:border-red-600 hover:text-red-600"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 border-t border-dashed border-zinc-300 py-12 lg:grid-cols-2">
          {/* TRENDING */}
          <section className="rounded-sm border border-dashed border-zinc-300 bg-white p-5">
            <SectionLabel>Trending searches</SectionLabel>
            <ul className="mt-4 grid gap-2 text-sm">
              {TRENDING.map((t) => (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    className="text-zinc-800 underline decoration-red-600 decoration-2 underline-offset-4 hover:text-red-600"
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* ALERTS OVERVIEW */}
          <section className="rounded-sm border border-dashed border-zinc-300 bg-white p-5">
            <SectionLabel>Safety alerts overview</SectionLabel>
            {stats && alertPct !== null ? (
              <div className="mt-4">
                <p className="text-sm text-zinc-600">
                  Of {stats.scored_carriers.toLocaleString()} carriers with SMS safety
                  scores:
                </p>
                <div className="mt-3 grid gap-3 text-sm">
                  <div>
                    <div className="flex justify-between font-mono text-xs">
                      <span>NO BASIC ALERTS</span>
                      <span className="font-bold">{100 - alertPct}%</span>
                    </div>
                    <div className="mt-1 h-3 bg-zinc-100">
                      <div
                        className="h-3 bg-zinc-900"
                        style={{ width: `${100 - alertPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-xs">
                      <span>1+ BASIC ALERT</span>
                      <span className="font-bold text-red-600">
                        {alertPct === 0 ? "<1" : alertPct}%
                      </span>
                    </div>
                    <div className="mt-1 h-3 bg-zinc-100">
                      <div
                        className="h-3 bg-red-600"
                        style={{ width: `${Math.max(alertPct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  FMCSA discontinued public safety-rating percentiles; alert flags shown
                  instead.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Loading safety statistics…</p>
            )}
          </section>
        </div>

        {/* LATEST UPDATES */}
        <section className="border-t border-dashed border-zinc-300 py-12">
          <SectionLabel>Latest FMCSA updates</SectionLabel>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              [fmt(updates?.new_carriers_this_week, "—"), "new carriers registered this week"],
              [
                fmt(updates?.inspections_last_month, "—"),
                `inspections recorded in ${updates?.inspections_month ?? "the latest month"}`,
              ],
              [fmt(stats?.total_violations, "—"), "violations on record (24-month window)"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-sm border border-dashed border-zinc-300 bg-white p-5"
              >
                <p className="font-heading text-3xl font-semibold">{value}</p>
                <p className="mt-1 text-sm text-zinc-600">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA ROW */}
        <section className="grid gap-4 border-t border-dashed border-zinc-300 py-12 sm:grid-cols-2">
          <div className="rounded-sm bg-zinc-950 p-6 text-white">
            <SectionLabel>API access</SectionLabel>
            <h3 className="font-heading mt-2 text-2xl font-semibold">
              The whole directory, programmatic.
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              Query carriers, safety scores, and inspections from your own systems.
            </p>
            <a
              href={`${API_URL}/docs`}
              className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
            >
              Explore the API
            </a>
          </div>
          <div className="rounded-sm border border-dashed border-zinc-300 bg-white p-6">
            <SectionLabel>Safety alerts</SectionLabel>
            <h3 className="font-heading mt-2 text-2xl font-semibold">
              Know when a record changes.
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Get notified when a carrier you work with picks up an alert, a violation, or
              an authority change.
            </p>
            <span className="mt-4 inline-block rounded-full border border-zinc-300 px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
              Coming soon
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-dashed border-zinc-300 py-12">
          <SectionLabel>Frequently asked questions</SectionLabel>
          <div className="mt-5 grid gap-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="rounded-sm border border-dashed border-zinc-300 bg-white p-4"
              >
                <summary className="font-heading cursor-pointer font-semibold">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-zinc-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
