import Link from "next/link";
import type { CarrierSummary } from "@/lib/api";
import SafetyBadge from "./SafetyBadge";

export default function CarrierCard({ carrier }: { carrier: CarrierSummary }) {
  const name = carrier.legal_name ?? `USDOT ${carrier.usdot_number}`;
  return (
    <Link
      href={carrier.slug ? `/carrier/${carrier.slug}` : "#"}
      className="block rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-blue-700">{name}</h3>
          {carrier.dba_name && (
            <p className="text-sm text-slate-500">DBA: {carrier.dba_name}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            USDOT {carrier.usdot_number}
            {carrier.mc_number ? ` · MC ${carrier.mc_number}` : ""}
            {carrier.state ? ` · ${carrier.state}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SafetyBadge rating={carrier.safety_rating} />
          {carrier.total_vehicles !== null && (
            <span className="text-xs text-slate-500">
              {carrier.total_vehicles} vehicles
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
