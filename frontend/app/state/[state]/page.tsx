import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CarrierCard from "@/components/CarrierCard";
import { searchCarriers } from "@/lib/api";
import { STATES, stateByCode } from "@/lib/states";

export const revalidate = 86400;

interface StatePageProps {
  params: { state: string };
  searchParams: { page?: string };
}

export function generateStaticParams(): { state: string }[] {
  return STATES.map((s) => ({ state: s.code.toLowerCase() }));
}

export function generateMetadata({ params }: StatePageProps): Metadata {
  const info = stateByCode(params.state);
  if (!info) return { title: "State not found" };
  return {
    title: `Trucking Companies in ${info.name} — Carrier Directory`,
    description: `Browse FMCSA-registered motor carriers based in ${info.name}. Fleet sizes, safety ratings, USDOT and MC numbers, contact details.`,
  };
}

export default async function StatePage({ params, searchParams }: StatePageProps) {
  const info = stateByCode(params.state);
  if (!info) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const results = await searchCarriers({
    state: info.code,
    page: String(page),
    per_page: "25",
  });

  return (
    <div>
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        {" / "}
        <span>{info.name}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold">Trucking companies in {info.name}</h1>
      {results ? (
        <>
          <p className="mt-1 text-sm text-slate-500">
            {results.total.toLocaleString()} FMCSA-registered carriers, largest fleets first
          </p>
          <div className="mt-6 grid gap-3">
            {results.items.map((carrier) => (
              <CarrierCard key={carrier.usdot_number} carrier={carrier} />
            ))}
          </div>
          {results.pages > 1 && (
            <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
              {page > 1 && (
                <Link
                  href={`/state/${params.state}?page=${page - 1}`}
                  className="text-blue-700 hover:underline"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-slate-500">
                Page {results.page} of {results.pages.toLocaleString()}
              </span>
              {page < results.pages && (
                <Link
                  href={`/state/${params.state}?page=${page + 1}`}
                  className="text-blue-700 hover:underline"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-8 text-slate-600">
          Listings are temporarily unavailable. Please try again in a moment.
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Browse other states</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATES.filter((s) => s.code !== info.code).map((s) => (
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
