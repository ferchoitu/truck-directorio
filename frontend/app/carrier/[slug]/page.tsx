import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SafetyBadge from "@/components/SafetyBadge";
import ShareActions from "@/components/ShareActions";
import Sparkline from "@/components/Sparkline";
import {
  getCarrierBySlug,
  getCarrierSafety,
  getTopCarriers,
  type CarrierDetail,
  type CarrierSafety,
} from "@/lib/api";

export const revalidate = 86400; // 24h ISR

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface CarrierPageProps {
  params: { slug: string };
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const carriers = await getTopCarriers(10_000);
  if (!carriers) return [];
  return carriers
    .filter((c): c is typeof c & { slug: string } => c.slug !== null)
    .map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: CarrierPageProps): Promise<Metadata> {
  const carrier = await getCarrierBySlug(params.slug);
  if (!carrier) return { title: "Carrier not found" };
  const name = carrier.legal_name ?? `USDOT ${carrier.usdot_number}`;
  return {
    title: `${name} (USDOT ${carrier.usdot_number}) | Safety Record`,
    description: `View safety data, inspections and violations for ${name}. USDOT ${carrier.usdot_number}${carrier.state ? `, based in ${carrier.state}` : ""}.`,
  };
}

function atomicAnswer(carrier: CarrierDetail, name: string, safety: CarrierSafety | null): string {
  const parts = [
    `USDOT ${carrier.usdot_number} is the FMCSA registration number for ${name}`,
  ];
  if (carrier.city && carrier.state) {
    parts.push(`, a motor carrier based in ${carrier.city}, ${carrier.state}`);
  }
  parts.push(".");
  if (carrier.total_vehicles) {
    parts.push(` The company operates ${carrier.total_vehicles.toLocaleString()} vehicles`);
    parts.push(carrier.total_drivers ? ` with ${carrier.total_drivers.toLocaleString()} drivers.` : ".");
  }
  if (safety && safety.inspections_total > 0) {
    parts.push(
      ` It has ${safety.inspections_total.toLocaleString()} roadside inspections and ${safety.violations_total.toLocaleString()} violations on record in the last 24 months.`
    );
  }
  return parts.join("");
}

export default async function CarrierPage({ params }: CarrierPageProps) {
  const carrier = await getCarrierBySlug(params.slug);
  if (!carrier) notFound();

  const safety = await getCarrierSafety(carrier.usdot_number);
  const name = carrier.legal_name ?? `USDOT ${carrier.usdot_number}`;
  const answer = atomicAnswer(carrier, name, safety);

  const faqs = [
    { q: `What is USDOT ${carrier.usdot_number}?`, a: answer },
    ...(safety && safety.violations_total > 0
      ? [
          {
            q: `How many violations does ${name} have?`,
            a: `${name} has ${safety.violations_total.toLocaleString()} recorded violations in the last 24 months across ${safety.inspections_total.toLocaleString()} roadside inspections, according to public FMCSA data.`,
          },
        ]
      : []),
    {
      q: `Is ${name} authorized to operate?`,
      a: carrier.authority_status
        ? `${name}'s registration status is ${carrier.authority_status} according to FMCSA records.`
        : `${name} is registered with the FMCSA under USDOT ${carrier.usdot_number}. Check the FMCSA SAFER system for current operating authority.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      ...(carrier.dba_name ? { alternateName: carrier.dba_name } : {}),
      identifier: `USDOT ${carrier.usdot_number}`,
      url: `${SITE_URL}/carrier/${params.slug}`,
      ...(carrier.phone ? { telephone: carrier.phone } : {}),
      ...(carrier.address || carrier.city
        ? {
            address: {
              "@type": "PostalAddress",
              ...(carrier.address ? { streetAddress: carrier.address } : {}),
              ...(carrier.city ? { addressLocality: carrier.city } : {}),
              ...(carrier.state ? { addressRegion: carrier.state } : {}),
              ...(carrier.zip ? { postalCode: carrier.zip } : {}),
              addressCountry: "US",
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        ...(carrier.state
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: carrier.state,
                item: `${SITE_URL}/state/${carrier.state.toLowerCase()}`,
              },
            ]
          : []),
        {
          "@type": "ListItem",
          position: carrier.state ? 3 : 2,
          name,
          item: `${SITE_URL}/carrier/${params.slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-red-600">Home</Link>
        {carrier.state && (
          <>
            {" / "}
            <Link href={`/state/${carrier.state.toLowerCase()}`} className="hover:text-red-600">
              {carrier.state}
            </Link>
          </>
        )}
        {" / "}
        <span>{name}</span>
      </nav>

      {/* Sticky compact header for mobile scrolling */}
      <header className="sticky top-0 z-10 -mx-4 mt-2 border-b bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold sm:text-2xl">{name}</h1>
            {carrier.dba_name && (
              <p className="text-sm text-slate-500">DBA: {carrier.dba_name}</p>
            )}
            <p className="text-sm text-slate-600">
              USDOT {carrier.usdot_number}
              {carrier.mc_number ? ` · MC ${carrier.mc_number}` : ""}
              {carrier.city ? ` · ${carrier.city}, ${carrier.state ?? ""}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SafetyBadge rating={carrier.safety_rating} />
            <ShareActions title={`${name} — FMCSA Safety Record`} />
          </div>
        </div>
        <dl className="mt-3 hidden grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid sm:grid-cols-4">
          {carrier.total_vehicles !== null && (
            <div>
              <dt className="text-slate-500">Fleet</dt>
              <dd className="font-medium">{carrier.total_vehicles.toLocaleString()} vehicles</dd>
            </div>
          )}
          {carrier.total_drivers !== null && (
            <div>
              <dt className="text-slate-500">Drivers</dt>
              <dd className="font-medium">{carrier.total_drivers.toLocaleString()}</dd>
            </div>
          )}
          {carrier.operation_type && (
            <div>
              <dt className="text-slate-500">Operation</dt>
              <dd className="font-medium">{carrier.operation_type}</dd>
            </div>
          )}
          {carrier.phone && (
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium">{carrier.phone}</dd>
            </div>
          )}
        </dl>
      </header>

      {/* Atomic answer for AI overviews */}
      <section className="mt-6 rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">What is USDOT {carrier.usdot_number}?</h2>
        <p className="mt-2 text-slate-700">{answer}</p>
      </section>

      {safety && safety.safety_scores.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Safety scores (SMS BASIC measures)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {safety.safety_scores.map((score) => (
              <div key={score.basic_category} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{score.basic_category}</span>
                  {score.alert_status === "alert" ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      ALERT
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      OK
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {score.score ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  SMS measure{score.measured_date ? ` · ${score.measured_date}` : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            BASIC percentiles are not publicly released by FMCSA; raw SMS measures shown. Lower
            is better.
          </p>
        </section>
      )}

      {safety && safety.inspections_total > 0 && (
        <section className="mt-6 rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Inspections (24 months)</h2>
            <span className="text-sm text-slate-500">
              {safety.inspections_total.toLocaleString()} total ·{" "}
              {safety.violations_total.toLocaleString()} violations
            </span>
          </div>
          <div className="mt-3">
            <Sparkline data={safety.inspections_monthly} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Violations</th>
                  <th className="py-2">OOS</th>
                </tr>
              </thead>
              <tbody>
                {safety.inspections.slice(0, 15).map((insp, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{insp.inspection_date ?? "—"}</td>
                    <td className="py-2 pr-4">{insp.inspection_type ?? "—"}</td>
                    <td className="py-2 pr-4">{insp.state ?? "—"}</td>
                    <td className="py-2 pr-4">{insp.violations_found ?? 0}</td>
                    <td className="py-2">{(insp.oos_vehicles ?? 0) + (insp.oos_drivers ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {safety && safety.violations.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Recent violations</h2>
          <ul className="mt-3 grid gap-2">
            {safety.violations.map((v, i) => (
              <li key={i} className="rounded-lg border bg-white p-3 text-sm">
                <span className="text-slate-500">{v.violation_date ?? ""}</span>
                {" · "}
                <span className="font-mono font-medium">{v.violation_code}</span>
                {" — "}
                {v.violation_description ?? "No description"}
                {v.oos_indicator && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                    OOS
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ for AI overviews */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Frequently asked questions</h2>
        <div className="mt-3 grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-lg border bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-8 border-t pt-4 text-xs text-slate-400">
        Data from public FMCSA records (Census + SMS).{" "}
        {carrier.last_scraped_at ? `Last enriched ${carrier.last_scraped_at.slice(0, 10)}. ` : ""}
        CarrierCheck is not affiliated with the FMCSA or US DOT.
      </footer>
    </article>
  );
}
