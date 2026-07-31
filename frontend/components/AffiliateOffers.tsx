import { selectOffers } from "@/lib/affiliates";

interface AffiliateOffersProps {
  totalVehicles: number | null;
  inspectionsTotal: number;
  violationsTotal: number;
  hasSafetyAlert: boolean;
}

/**
 * Sponsored offers, placed below the carrier's own data so the page's organic
 * content stays first. Renders nothing until a partner program is configured.
 *
 * Links carry rel="sponsored" — Google requires it for paid/affiliate links, and
 * omitting it on 2.2M pages is exactly the pattern that earns a manual action.
 */
export default function AffiliateOffers({
  totalVehicles,
  inspectionsTotal,
  violationsTotal,
  hasSafetyAlert,
}: AffiliateOffersProps) {
  const offers = selectOffers({
    totalVehicles,
    inspectionsTotal,
    violationsTotal,
    hasSafetyAlert,
  });
  if (offers.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl bg-white shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          Sponsored
        </p>
        <p className="text-xs text-zinc-400">
          We may earn a commission on these links
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {offers.map((offer) => (
          <a
            key={offer.category}
            href={offer.url}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="group flex flex-col rounded-xl border border-zinc-200 p-4 transition hover:border-lime-400 hover:shadow-sm"
          >
            <p className="text-sm font-semibold group-hover:text-lime-700">
              {offer.headline}
            </p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-600">
              {offer.blurb}
            </p>
            <p className="mt-3 text-xs font-semibold text-lime-700">
              {offer.cta} →
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
