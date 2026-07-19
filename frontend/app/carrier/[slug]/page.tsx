import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SafetyBadge from "@/components/SafetyBadge";
import {
  getCarrierBySlug,
  getCarrierSafety,
  getTopCarriers,
  type CarrierSafety,
} from "@/lib/api";

export const revalidate = 86400; // 24h ISR

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
    description: `View safety ratings, BASIC scores, inspections and violations for ${name}. USDOT ${carrier.usdot_number}.`,
  };
}

function SafetySection({ safety }: { safety: CarrierSafety }) {
  return (
    <>
      {safety.safety_scores.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">BASIC scores</h2>
          <div className="mt-3 grid gap-2">
            {safety.safety_scores.map((score) => {
              const pct = Math.min(100, Math.max(0, score.percentile ?? 0));
              return (
                <div key={score.basic_category} className="rounded-lg border bg-white p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{score.basic_category}</span>
                    <span className="text-slate-500">
                      {score.percentile !== null ? `${score.percentile}th percentile` : "—"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${
                        pct >= 75 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {safety.inspections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Inspection history</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Violations</th>
                  <th className="px-4 py-2">OOS vehicles</th>
                </tr>
              </thead>
              <tbody>
                {safety.inspections.map((insp, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2">{insp.inspection_date ?? "—"}</td>
                    <td className="px-4 py-2">{insp.inspection_type ?? "—"}</td>
                    <td className="px-4 py-2">{insp.state ?? "—"}</td>
                    <td className="px-4 py-2">{insp.violations_found ?? 0}</td>
                    <td className="px-4 py-2">{insp.oos_vehicles ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {safety.violations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Recent violations</h2>
          <ul className="mt-3 grid gap-2">
            {safety.violations.map((v, i) => (
              <li key={i} className="rounded-lg border bg-white p-3 text-sm">
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
    </>
  );
}

export default async function CarrierPage({ params }: CarrierPageProps) {
  const carrier = await getCarrierBySlug(params.slug);
  if (!carrier) notFound();

  const safety = await getCarrierSafety(carrier.usdot_number);
  const name = carrier.legal_name ?? `USDOT ${carrier.usdot_number}`;

  return (
    <article>
      <header className="rounded-lg border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            {carrier.dba_name && <p className="text-slate-500">DBA: {carrier.dba_name}</p>}
          </div>
          <SafetyBadge rating={carrier.safety_rating} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">USDOT</dt>
            <dd className="font-medium">{carrier.usdot_number}</dd>
          </div>
          {carrier.mc_number && (
            <div>
              <dt className="text-slate-500">MC number</dt>
              <dd className="font-medium">{carrier.mc_number}</dd>
            </div>
          )}
          {carrier.address && (
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium">
                {carrier.address}
                {carrier.city ? `, ${carrier.city}` : ""}
                {carrier.state ? `, ${carrier.state}` : ""} {carrier.zip ?? ""}
              </dd>
            </div>
          )}
          {carrier.phone && (
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium">{carrier.phone}</dd>
            </div>
          )}
          {carrier.total_vehicles !== null && (
            <div>
              <dt className="text-slate-500">Fleet size</dt>
              <dd className="font-medium">{carrier.total_vehicles} vehicles</dd>
            </div>
          )}
          {carrier.total_drivers !== null && (
            <div>
              <dt className="text-slate-500">Drivers</dt>
              <dd className="font-medium">{carrier.total_drivers}</dd>
            </div>
          )}
          {carrier.operation_type && (
            <div>
              <dt className="text-slate-500">Operation</dt>
              <dd className="font-medium">{carrier.operation_type}</dd>
            </div>
          )}
          {carrier.authority_status && (
            <div>
              <dt className="text-slate-500">Authority</dt>
              <dd className="font-medium">{carrier.authority_status}</dd>
            </div>
          )}
        </dl>
      </header>

      {safety && <SafetySection safety={safety} />}
    </article>
  );
}
