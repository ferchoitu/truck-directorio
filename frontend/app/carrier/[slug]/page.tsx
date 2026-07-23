import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import SafetyBadge from "@/components/SafetyBadge";
import SectionLabel from "@/components/SectionLabel";
import ShareActions from "@/components/ShareActions";
import Sparkline from "@/components/Sparkline";
import {
  getCarrierBySlug,
  getCarrierSafety,
  getTopCarriers,
  type CarrierDetail,
  type CarrierSafety,
} from "@/lib/api";
import { stateByCode } from "@/lib/states";

export const revalidate = 86400; // 24h ISR

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const CLAIM_CONTACT = "mailto:iturriozfermin@gmail.com?subject=Claim%20profile%20USDOT%20";

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
  const canonicalSlug = carrier.slug ?? params.slug;
  return {
    title: `${name} (USDOT ${carrier.usdot_number}) | Safety Record`,
    description: `View safety data, inspections and violations for ${name}. USDOT ${carrier.usdot_number}${carrier.state ? `, based in ${carrier.state}` : ""}.`,
    alternates: { canonical: `/carrier/${canonicalSlug}` },
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

const SECTIONS = [
  ["contact", "Contact"],
  ["registration", "Registration & Authority"],
  ["fleet", "Fleet & Drivers"],
  ["safety", "Safety & Compliance"],
  ["inspections", "Inspections"],
  ["violations", "Violations"],
] as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-zinc-200 py-2.5 last:border-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default async function CarrierPage({ params }: CarrierPageProps) {
  const carrier = await getCarrierBySlug(params.slug);
  if (!carrier) notFound();
  if (carrier.slug && params.slug !== carrier.slug) {
    permanentRedirect(`/carrier/${carrier.slug}`);
  }

  const safety = await getCarrierSafety(carrier.usdot_number);
  const name = carrier.legal_name ?? `USDOT ${carrier.usdot_number}`;
  const answer = atomicAnswer(carrier, name, safety);
  const usdot = carrier.usdot_number;
  const stateName = carrier.state ? stateByCode(carrier.state)?.name ?? carrier.state : null;

  const officialLinks = [
    {
      title: "FMCSA Company Snapshot",
      desc: "Registration details, safety record, and operation info on SAFER",
      href: `https://safer.fmcsa.dot.gov/query.asp?searchType=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${usdot}`,
    },
    {
      title: "SMS Safety Measurement Results",
      desc: "Crash history, inspections, and safety scores on ai.fmcsa.dot.gov",
      href: `https://ai.fmcsa.dot.gov/SMS/Carrier/${usdot}/Overview.aspx`,
    },
    {
      title: "FMCSA Licensing & Insurance",
      desc: "Operating authority, insurance filings, and bond status",
      href: "https://li-public.fmcsa.dot.gov/LIVIEW/pkg_carrquery.prc_carrlist",
    },
  ];

  const faqs = [
    { q: `What is USDOT ${usdot}?`, a: answer },
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
        : `${name} is registered with the FMCSA under USDOT ${usdot}. Check the FMCSA SAFER system for current operating authority.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      ...(carrier.dba_name ? { alternateName: carrier.dba_name } : {}),
      identifier: `USDOT ${usdot}`,
      url: `${SITE_URL}/carrier/${carrier.slug ?? params.slug}`,
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
                name: stateName,
                item: `${SITE_URL}/state/${carrier.state.toLowerCase()}`,
              },
            ]
          : []),
        {
          "@type": "ListItem",
          position: carrier.state ? 3 : 2,
          name,
          item: `${SITE_URL}/carrier/${carrier.slug ?? params.slug}`,
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

      <nav className="text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-900">Home</Link>
        {carrier.state && (
          <>
            {" / "}
            <Link href={`/state/${carrier.state.toLowerCase()}`} className="hover:text-zinc-900">
              {stateName}
            </Link>
          </>
        )}
        {" / "}
        <span className="text-zinc-800">{name}</span>
      </nav>

      {/* TITLE CARD */}
      <header className="mt-3 rounded-2xl bg-white shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{name}</h1>
            {carrier.dba_name && (
              <p className="text-sm text-zinc-500">DBA: {carrier.dba_name}</p>
            )}
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
              USDOT {usdot}
              {carrier.mc_number ? ` · MC ${carrier.mc_number}` : ""}
              {carrier.city ? ` · ${carrier.city}, ${carrier.state ?? ""}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SafetyBadge rating={carrier.safety_rating} />
            <ShareActions title={`${name} — FMCSA Safety Record`} />
          </div>
        </div>
        {/* Section index */}
        <nav className="mt-4 flex gap-4 overflow-x-auto border-t border-dashed border-zinc-200 pt-3 text-xs">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="whitespace-nowrap font-mono font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* ATOMIC ANSWER */}
      <section className="mt-4 rounded-2xl bg-white shadow-sm p-5">
        <h2 className="font-heading text-lg font-semibold">What is USDOT {usdot}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">{answer}</p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* CONTACT */}
        <section id="contact" className="scroll-mt-24 rounded-2xl bg-white shadow-sm p-5">
          <SectionLabel>Contact information</SectionLabel>
          <div className="mt-3 rounded-xl bg-stone-100 p-3 text-sm">
            <p className="font-medium">This profile hasn&apos;t been claimed yet</p>
            <p className="mt-0.5 text-zinc-600">
              Is this your company?{" "}
              <a href={`${CLAIM_CONTACT}${usdot}`} className="font-semibold text-lime-700 underline decoration-2 underline-offset-2 hover:text-lime-600">
                Claim this profile
              </a>
            </p>
          </div>
          <dl className="mt-3">
            {(carrier.address || carrier.city) && (
              <Row
                label="Physical address"
                value={
                  <>
                    {carrier.address}
                    {carrier.address ? <br /> : null}
                    {carrier.city}
                    {carrier.state ? `, ${carrier.state}` : ""} {carrier.zip ?? ""}
                  </>
                }
              />
            )}
            {carrier.phone && <Row label="Phone" value={carrier.phone} />}
            {carrier.email && <Row label="Email" value={carrier.email} />}
          </dl>
        </section>

        {/* REGISTRATION & AUTHORITY */}
        <section id="registration" className="scroll-mt-24 rounded-2xl bg-white shadow-sm p-5">
          <SectionLabel>Registration &amp; authority</SectionLabel>
          <dl className="mt-3">
            <Row label="USDOT number" value={usdot} />
            {carrier.mc_number && <Row label="MC number" value={carrier.mc_number} />}
            <Row label="Legal name" value={name} />
            {carrier.authority_status && (
              <Row
                label="Status"
                value={
                  <span
                    className={
                      carrier.authority_status.toUpperCase() === "ACTIVE"
                        ? "text-green-700"
                        : undefined
                    }
                  >
                    {carrier.authority_status}
                  </span>
                }
              />
            )}
            {carrier.carrier_classification && (
              <Row label="Entity type" value={carrier.carrier_classification} />
            )}
            {carrier.operation_type && (
              <Row label="Carrier operation" value={carrier.operation_type} />
            )}
            {carrier.duns_number && <Row label="DUNS" value={carrier.duns_number} />}
            {carrier.last_scraped_at && (
              <Row label="Last enriched" value={carrier.last_scraped_at.slice(0, 10)} />
            )}
          </dl>
        </section>
      </div>

      {/* OFFICIAL SOURCES */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {officialLinks.map((l) => (
          <a
            key={l.title}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl bg-white shadow-sm p-4 transition hover:shadow-md"
          >
            <p className="text-sm font-semibold group-hover:text-lime-700">{l.title} ↗</p>
            <p className="mt-1 text-xs text-zinc-500">{l.desc}</p>
          </a>
        ))}
      </section>

      {/* FLEET & DRIVERS */}
      <section id="fleet" className="mt-4 scroll-mt-24 rounded-2xl bg-white shadow-sm p-5">
        <SectionLabel>Fleet &amp; drivers</SectionLabel>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [carrier.total_vehicles, "Power units"],
            [carrier.total_drivers, "Drivers"],
            [safety?.inspections_total ?? null, "Inspections (24 mo)"],
            [safety?.violations_total ?? null, "Violations (24 mo)"],
          ].map(([value, label]) => (
            <div key={String(label)}>
              <p className="font-heading text-3xl font-semibold">
                {typeof value === "number" ? value.toLocaleString() : "—"}
              </p>
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SAFETY & COMPLIANCE */}
      <section id="safety" className="mt-4 scroll-mt-24">
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <SectionLabel>Safety &amp; compliance</SectionLabel>
          {!carrier.safety_rating && (
            <p className="mt-3 rounded-xl bg-stone-100 p-3 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-800">Not Rated.</span> No FMCSA
              safety/compliance review has been conducted on this motor carrier — this is
              the case for most carriers and is not itself a warning sign.
            </p>
          )}
          {safety && safety.safety_scores.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {safety.safety_scores.map((score) => (
                <div key={score.basic_category} className="rounded-xl border border-zinc-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{score.basic_category}</span>
                    {score.alert_status === "alert" ? (
                      <span className="bg-red-100 px-2 py-0.5 font-mono text-xs font-bold text-red-800">
                        ALERT
                      </span>
                    ) : (
                      <span className="bg-green-100 px-2 py-0.5 font-mono text-xs font-bold text-green-800">
                        OK
                      </span>
                    )}
                  </div>
                  <p className="font-heading mt-1 text-2xl font-semibold">
                    {score.score ?? "—"}
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    SMS measure{score.measured_date ? ` · ${score.measured_date}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No SMS BASIC measures on file — the carrier has no scored roadside
              inspections in the current 24-month window.
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            BASIC percentiles are not publicly released by FMCSA (FAST Act); raw SMS
            measures shown. Lower is better.
          </p>
        </div>
      </section>

      {/* INSPECTIONS */}
      {safety && safety.inspections_total > 0 && (
        <section id="inspections" className="mt-4 scroll-mt-24 rounded-2xl bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Inspections (24 months)</SectionLabel>
            <span className="font-mono text-xs text-zinc-500">
              {safety.inspections_total.toLocaleString()} TOTAL
            </span>
          </div>
          <div className="mt-3">
            <Sparkline data={safety.inspections_monthly} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 font-mono text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-bold">Date</th>
                  <th className="py-2 pr-4 font-bold">Type</th>
                  <th className="py-2 pr-4 font-bold">State</th>
                  <th className="py-2 pr-4 font-bold">Violations</th>
                  <th className="py-2 font-bold">OOS</th>
                </tr>
              </thead>
              <tbody>
                {safety.inspections.slice(0, 15).map((insp, i) => (
                  <tr key={i} className="border-b border-dashed border-zinc-200 last:border-0">
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

      {/* VIOLATIONS */}
      {safety && safety.violations.length > 0 && (
        <section id="violations" className="mt-4 scroll-mt-24 rounded-2xl bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Recent violations</SectionLabel>
            <span className="font-mono text-xs text-zinc-500">
              {safety.violations_total.toLocaleString()} TOTAL · SHOWING LATEST 10
            </span>
          </div>
          <ul className="mt-3 grid gap-2">
            {safety.violations.map((v, i) => (
              <li key={i} className="border-b border-dashed border-zinc-200 pb-2 text-sm last:border-0">
                <span className="font-mono text-xs text-zinc-500">{v.violation_date ?? ""}</span>
                {" · "}
                <span className="font-mono font-bold">{v.violation_code}</span>
                {" — "}
                {v.violation_description ?? "No description"}
                {v.oos_indicator && (
                  <span className="ml-2 bg-red-100 px-2 py-0.5 font-mono text-xs font-bold text-red-800">
                    OOS
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* SERVICE AREA */}
      {(carrier.city || carrier.operation_type) && (
        <section className="mt-4 rounded-2xl bg-white shadow-sm p-5">
          <SectionLabel>Service area</SectionLabel>
          <dl className="mt-3">
            {carrier.city && (
              <Row label="Headquarters" value={`${carrier.city}, ${stateName ?? ""}`} />
            )}
            {carrier.operation_type && (
              <Row
                label="Coverage"
                value={
                  carrier.operation_type === "Interstate"
                    ? "Interstate (operates across state lines)"
                    : `${stateName ?? "Home state"} only (${carrier.operation_type})`
                }
              />
            )}
          </dl>
        </section>
      )}

      {/* FAQ */}
      <section className="mt-6">
        <SectionLabel>Frequently asked questions</SectionLabel>
        <div className="mt-3 grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-2xl bg-white shadow-sm p-4">
              <summary className="font-heading cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-8 border-t border-dashed border-zinc-300 pt-4 text-xs text-zinc-400">
        Data from public FMCSA records (Census + SMS). YoTruck is not affiliated with
        the FMCSA or US DOT.
      </footer>
    </article>
  );
}
