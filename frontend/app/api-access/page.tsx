import type { Metadata } from "next";
import CheckoutButton from "@/components/CheckoutButton";
import SectionLabel from "@/components/SectionLabel";

export const metadata: Metadata = {
  title: "Carrier Data API — 2.2M FMCSA Carriers",
  description:
    "Plug FMCSA carrier data into your stack: registrations, SMS safety measures, inspections, and violations for 2.2M+ US motor carriers via REST API.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CONTACT = "mailto:nuclealabs@gmail.com?subject=YoTruck%20API%20access";

const EXAMPLE = `curl -H "Authorization: Bearer yt_live_..." \\
  "${API_URL}/api/v1/carriers/86876/safety"

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

const ENDPOINTS = [
  ["GET", "/api/v1/carriers", "Filter by state, type, rating, fleet size"],
  ["GET", "/api/v1/carriers/search", "Search by name, USDOT, or MC number"],
  ["GET", "/api/v1/carriers/{usdot}", "Full registration record"],
  ["GET", "/api/v1/carriers/{usdot}/safety", "BASIC measures, inspections, violations"],
  ["GET", "/api/v1/usage", "Requests consumed this period (free, unmetered)"],
];

interface Tier {
  name: string;
  price: string;
  note?: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
  /** Buyable tier: opens the Paddle overlay rather than following the href. */
  checkout?: boolean;
  /** Paddle price. Undefined while the tier's env var is unset — the button
   *  then degrades to the mailto in `cta.href` instead of going dead. */
  priceId?: string;
}

const TIERS: Tier[] = [
  {
    name: "Explore",
    price: "Free",
    features: [
      "Interactive OpenAPI docs",
      "Browse every endpoint and schema",
      "No card, no signup",
    ],
    cta: { label: "Open the docs", href: `${API_URL}/docs` },
  },
  {
    name: "Growth",
    price: "$49/mo",
    note: "$0.98 per 1k requests",
    features: [
      "50,000 requests/month",
      "All /v1 endpoints",
      "API key issued instantly at checkout",
    ],
    cta: { label: "Subscribe", href: CONTACT },
    checkout: true,
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH,
  },
  {
    name: "Standard",
    price: "$99.90/mo",
    note: "$0.67 per 1k requests",
    features: [
      "150,000 requests/month",
      "All /v1 endpoints",
      "Email support",
    ],
    cta: { label: "Subscribe", href: CONTACT },
    highlight: true,
    checkout: true,
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_STANDARD,
  },
  {
    name: "Pro",
    price: "$149/mo",
    note: "$0.50 per 1k requests",
    features: [
      "300,000 requests/month",
      "All /v1 endpoints",
      "Priority email support",
    ],
    cta: { label: "Subscribe", href: CONTACT },
    checkout: true,
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO,
  },
  {
    name: "Enterprise",
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
          <SectionLabel>Endpoints</SectionLabel>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <tbody>
                {ENDPOINTS.map(([method, path, description]) => (
                  <tr key={path} className="border-b border-zinc-200 last:border-0">
                    <td className="py-3 pr-4 align-top">
                      <span className="rounded bg-zinc-900 px-2 py-1 font-mono text-xs font-bold text-lime-300">
                        {method}
                      </span>
                    </td>
                    <td className="py-3 pr-4 align-top font-mono text-xs text-zinc-900">
                      {path}
                    </td>
                    <td className="py-3 align-top text-zinc-600">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Authenticate with <code className="font-mono">Authorization: Bearer</code>{" "}
            and your key. Quota resets on a rolling 30-day period.
          </p>
        </section>

        <section className="border-t border-zinc-200 py-12">
          <SectionLabel>Plans</SectionLabel>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((t) => {
              const ctaClass = `mt-5 inline-block w-full rounded-full px-4 py-2 text-center text-sm font-semibold transition ${
                t.highlight
                  ? "bg-zinc-900 text-white hover:bg-zinc-700"
                  : "border border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
              }`;
              return (
                <div
                  key={t.name}
                  className={`flex flex-col rounded-xl border p-5 ${
                    t.highlight
                      ? "border-lime-400 bg-white shadow-md"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
                      {t.name}
                    </p>
                    {t.highlight && (
                      <span className="rounded-full bg-lime-300 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-zinc-900">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="font-heading mt-2 text-2xl font-semibold">{t.price}</p>
                  <p className="mt-0.5 h-4 text-xs text-zinc-400">{t.note ?? ""}</p>
                  <ul className="mt-4 grid flex-1 gap-2 text-sm text-zinc-600">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-lime-600">·</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {t.checkout ? (
                    <CheckoutButton
                      label={t.cta.label}
                      priceId={t.priceId}
                      fallbackHref={t.cta.href}
                      className={ctaClass}
                    />
                  ) : (
                    <a href={t.cta.href} className={ctaClass}>
                      {t.cta.label}
                    </a>
                  )}
                </div>
              );
            })}
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
