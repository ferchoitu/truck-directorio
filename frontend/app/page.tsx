import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import SectionLabel from "@/components/SectionLabel";
import { getStateCounts, getStats, getUpdates } from "@/lib/api";
import { STATES, stateByCode } from "@/lib/states";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO — dark rounded container with lime glow */}
      <section className="relative -mt-16 overflow-hidden rounded-3xl bg-zinc-950 px-5 pb-16 pt-28 text-white sm:px-10 sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 45% at 85% 0%, rgba(190,242,100,0.22), transparent 70%), radial-gradient(45% 35% at 0% 100%, rgba(190,242,100,0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <SectionLabel>FMCSA carrier safety directory</SectionLabel>
          <h1 className="font-heading mt-5 text-4xl font-medium leading-tight sm:text-6xl">
            Know every carrier{" "}
            <em className="italic text-lime-300">before the load moves.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-zinc-300">
            Registration, safety measures, inspections, and violations for every active US
            motor carrier — in one search.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar dark />
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            {fmt(stats?.total_carriers, "2.2M+")} carriers ·{" "}
            {fmt(stats?.total_safety_scores, "1.8M+")} safety scores ·{" "}
            {fmt(stats?.total_inspections, "5.7M+")} inspections · updated weekly
          </p>
        </div>
      </section>

      {/* STATEMENT */}
      <section className="mx-auto max-w-3xl py-16 text-center sm:py-20">
        <SectionLabel>The problem</SectionLabel>
        <h2 className="font-heading mt-4 text-3xl font-medium leading-snug sm:text-4xl">
          Most lookups show one number.{" "}
          <em className="italic text-zinc-500">Vetting a carrier</em> needs the{" "}
          <em className="italic text-zinc-500">full record.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600">
          CarrierCheck joins the FMCSA census with the complete SMS safety file — measures,
          inspections, and violations — so the whole picture is one search away.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <div className="text-center">
          <SectionLabel>How it works</SectionLabel>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
            <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-sm font-bold text-zinc-950">
                {s.n}
              </span>
              <h3 className="font-heading mt-4 text-2xl font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BROWSE BY STATE */}
      <section id="states" className="mt-16 scroll-mt-24">
        <div className="text-center">
          <SectionLabel>Browse by state</SectionLabel>
        </div>
        {states && states.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {states.slice(0, 10).map((s) => (
                <Link
                  key={s.state}
                  href={`/state/${s.state.toLowerCase()}`}
                  className="group rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="font-heading text-2xl font-medium group-hover:text-lime-600">
                    {s.state}
                  </div>
                  <div className="text-sm font-medium text-zinc-700">
                    {s.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-400">{stateByCode(s.state)?.name}</div>
                </Link>
              ))}
            </div>
            <details className="mt-4 text-center">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-600 hover:text-zinc-900">
                All states & territories ↓
              </summary>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STATES.map((s) => (
                  <Link
                    key={s.code}
                    href={`/state/${s.code.toLowerCase()}`}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 hover:border-lime-400 hover:text-zinc-900"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {STATES.map((s) => (
              <Link
                key={s.code}
                href={`/state/${s.code.toLowerCase()}`}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 hover:border-lime-400 hover:text-zinc-900"
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-16 grid gap-4 lg:grid-cols-2">
        {/* TRENDING */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionLabel>Trending searches</SectionLabel>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {TRENDING.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="font-medium text-zinc-800 underline decoration-lime-400 decoration-2 underline-offset-4 hover:text-zinc-950"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ALERTS OVERVIEW */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <SectionLabel>Safety alerts overview</SectionLabel>
          {stats && alertPct !== null ? (
            <div className="mt-4">
              <p className="text-sm text-zinc-600">
                Of {stats.scored_carriers.toLocaleString()} carriers with SMS safety scores:
              </p>
              <div className="mt-4 grid gap-4 text-sm">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span>No BASIC alerts</span>
                    <span className="text-zinc-900">{100 - alertPct}%</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-zinc-100">
                    <div
                      className="h-3 rounded-full bg-lime-400"
                      style={{ width: `${100 - alertPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span>1+ BASIC alert</span>
                    <span className="text-red-600">{alertPct === 0 ? "<1" : alertPct}%</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-zinc-100">
                    <div
                      className="h-3 rounded-full bg-red-500"
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
      <section className="mt-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [fmt(updates?.new_carriers_this_week, "—"), "new carriers registered this week"],
            [
              fmt(updates?.inspections_last_month, "—"),
              `inspections recorded in ${updates?.inspections_month ?? "the latest month"}`,
            ],
            [fmt(stats?.total_violations, "—"), "violations on record (24-month window)"],
          ].map(([value, label]) => (
            <div key={label as string} className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="font-heading text-3xl font-medium">{value}</p>
              <p className="mt-1 text-sm text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA ROW */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 100% 0%, rgba(190,242,100,0.18), transparent 70%)",
            }}
          />
          <div className="relative">
            <SectionLabel>Carrier data API</SectionLabel>
            <h3 className="font-heading mt-4 text-3xl font-medium leading-snug">
              Plug 2.2M carriers{" "}
              <em className="italic text-lime-300">into your stack.</em>
            </h3>
            <p className="mt-3 max-w-md text-sm text-zinc-300">
              Registrations, safety scores, inspections and violations over REST — for
              TMSs, brokers, insurtechs, and factoring platforms.
            </p>
            <Link
              href="/api-access"
              className="mt-6 inline-block rounded-full bg-lime-300 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200"
            >
              See plans & pricing
            </Link>
          </div>
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <SectionLabel>Safety alerts</SectionLabel>
          <h3 className="font-heading mt-4 text-3xl font-medium leading-snug">
            Know when a record <em className="italic text-zinc-500">changes.</em>
          </h3>
          <p className="mt-3 max-w-md text-sm text-zinc-600">
            Get notified when a carrier you work with picks up an alert, a violation, or an
            authority change.
          </p>
          <span className="mt-6 inline-block rounded-full border border-zinc-200 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Coming soon
          </span>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <div className="text-center">
          <SectionLabel>Frequently asked questions</SectionLabel>
        </div>
        <div className="mx-auto mt-6 grid max-w-3xl gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white p-5 shadow-sm">
              <summary className="font-heading cursor-pointer text-lg font-medium">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
