import type { Metadata } from "next";
import Link from "next/link";
import CarrierCard from "@/components/CarrierCard";
import SearchBar from "@/components/SearchBar";
import { searchCarriers } from "@/lib/api";

export const metadata: Metadata = {
  title: "Search Carriers",
  description: "Search FMCSA motor carriers by USDOT number, MC number, or company name.",
};

interface SearchPageProps {
  searchParams: { q?: string; state?: string; page?: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const params: Record<string, string> = { page: String(page), per_page: "25" };
  if (q) params.q = q;
  if (searchParams.state) params.state = searchParams.state;

  const results = q || searchParams.state ? await searchCarriers(params) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Search carriers</h1>
      <div className="mt-4">
        <SearchBar defaultValue={q} />
      </div>

      {results === null && (q || searchParams.state) && (
        <p className="mt-8 text-slate-600">
          Search is temporarily unavailable. Please try again in a moment.
        </p>
      )}

      {results && (
        <div className="mt-8">
          <p className="text-sm text-slate-500">
            {results.total.toLocaleString()} carriers found
          </p>
          <div className="mt-4 grid gap-3">
            {results.items.map((carrier) => (
              <CarrierCard key={carrier.usdot_number} carrier={carrier} />
            ))}
          </div>
          {results.pages > 1 && (
            <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
              {page > 1 && (
                <Link
                  href={`/search?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  className="text-blue-700 hover:underline"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-slate-500">
                Page {results.page} of {results.pages}
              </span>
              {page < results.pages && (
                <Link
                  href={`/search?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                  className="text-blue-700 hover:underline"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
