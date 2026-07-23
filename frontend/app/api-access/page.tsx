import type { Metadata } from "next";
import SectionLabel from "@/components/SectionLabel";

export const metadata: Metadata = {
  title: "Carrier Data API — 2.2M FMCSA Carriers",
  description:
    "Plug FMCSA carrier data into your stack: registrations, SMS safety measures, inspections, and violations for 2.2M+ US motor carriers via REST API.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CONTACT = "mailto:iturriozfermin@gmail.com?subject=YoTruck%20API%20access";

const EXAMPLE = `curl "https://backend-production-9a9f.up.railway.app/api/carriers/86876/safety"

{
  "usdot_number": "86876",
  "safety_scores": [
    { "basic_category": "Unsafe Driving",
      "score": "1.08", "alert_status": "ok" },
    ...
  ],
  "inspections_total": 21908,
  "violations_total": 14236
}`;

const TIERS = [
  {
    name: "Explore",
    price: "Free",
    features: ["Interactive API docs", "Try every endpoint", "No key required (rate-limited)"],
    cta: { label: "Open the docs", href: `${API_URL}/docs` },
  },
  {
    name: "Growth",
    price: "$49/mo",
    features: [
      "50,000 requests/month",
      "All endpoints: carriers, safety, inspections",
      "Email support",
    ],
    cta: { label: "Get in touch", href: CONTACT },
    highlight: true,
  },
  {
    name: "Scale",
    price: "Custom",
    features: [
      "Volume pricing per request",
      "Bulk exports & webhooks",
      "SLA and dedicated support",
    ],
    cta: { label: "Talk to us", href: CONTACT },
  },
];

export default function ApiAccessPage() {
  return (
    <div>
      <section className="relative -mt-16 overflow-hidden rounded-3xl bg-zinc-950 px-5 pb-14 pt-28 text-white sm:px-10 sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 90% 0%, rgba(190,242,100,0.2), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <SectionLabel>Carrier data API</SectionLabel>
          <h1 className="font-heading mt-4 max-w-3xl text-4xl font-medium leading-tight sm:text-5xl">
            Plug 2.2M carriers <em className="italic text-lime-300">into your stack.</em>
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300">
            The same data behind YoTruck, over REST: FMCSA registrations, SMS BASIC
            measures, 24-month inspection history, and violations — refreshed as the
            government publishes it.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl">
        <section className="grid gap-8 py-12 lg:grid-cols-2">
          <div>
            <SectionLabel>What you get</SectionLabel>
            <ul className="mt-4 grid gap-3 text-sm text-zinc-700">
              {[
                "2.2M+ active carriers: name, DBA, USDOT/MC, address, phone, fleet size",
                "SMS BASIC measures with acute/critical alert flags (5 categories)",
                "5.7M itemized roadside inspections (24-month rolling window)",
                "6.7M violations with codes, descriptions, severity, and OOS flags",
                "Search by name, USDOT, or MC; filter by state, type, rating, fleet size",
                "Daily new-carrier ingestion from the FMCSA census",
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="font-bold text-lime-600">→</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionLabel>One call away</SectionLabel>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
              {EXAMPLE}
            </pre>
          </div>
        </section>

        <section className="border-t border-zinc-200 py-12">
          <SectionLabel>Plans</SectionLabel>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`rounded-xl border p-6 ${
                  t.highlight
                    ? "border-lime-400 bg-white shadow-md"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {t.name}
                </p>
                <p className="font-heading mt-2 text-3xl font-semibold">{t.price}</p>
                <ul className="mt-4 grid gap-2 text-sm text-zinc-600">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-lime-600">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={t.cta.href}
                  className={`mt-5 inline-block rounded-full px-5 py-2 text-sm font-semibold transition ${
                    t.highlight
                      ? "bg-zinc-900 text-white hover:bg-zinc-700"
                      : "border border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {t.cta.label}
                </a>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Data comes from public FMCSA records. Plans are being finalized — early
            integrators get grandfathered pricing.
          </p>
        </section>
      </div>
    </div>
  );
}
