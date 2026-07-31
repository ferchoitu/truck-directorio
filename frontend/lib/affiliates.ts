/**
 * Affiliate offer catalog.
 *
 * Partner URLs come from env so the block simply disappears until a program is
 * actually signed — no dead links, no placeholder cards in production.
 *
 * Next.js inlines NEXT_PUBLIC_* at build time, so each variable must be
 * referenced statically here; a computed `process.env[key]` lookup would resolve
 * to undefined in the browser bundle.
 */

export type AffiliateCategory = "insurance" | "eld" | "factoring" | "compliance";

const PARTNER_URLS: Record<AffiliateCategory, string | undefined> = {
  insurance: process.env.NEXT_PUBLIC_AFF_INSURANCE_URL,
  eld: process.env.NEXT_PUBLIC_AFF_ELD_URL,
  factoring: process.env.NEXT_PUBLIC_AFF_FACTORING_URL,
  compliance: process.env.NEXT_PUBLIC_AFF_COMPLIANCE_URL,
};

export interface AffiliateOffer {
  category: AffiliateCategory;
  headline: string;
  blurb: string;
  cta: string;
  url: string;
}

const CATALOG: Record<AffiliateCategory, Omit<AffiliateOffer, "url">> = {
  insurance: {
    category: "insurance",
    headline: "Commercial truck insurance quotes",
    blurb:
      "Compare liability and physical damage coverage from insurers that write policies for FMCSA-registered motor carriers.",
    cta: "Compare quotes",
  },
  compliance: {
    category: "compliance",
    headline: "DOT compliance support",
    blurb:
      "Roadside violations and BASIC alerts can raise your premiums and trigger an audit. Get help building a corrective action plan.",
    cta: "Get compliance help",
  },
  factoring: {
    category: "factoring",
    headline: "Freight factoring",
    blurb:
      "Get paid on your invoices in about 24 hours instead of waiting 30 to 60 days on broker terms.",
    cta: "See factoring rates",
  },
  eld: {
    category: "eld",
    headline: "ELD & fleet management",
    blurb:
      "Electronic logging, HOS tracking, and IFTA reporting that keep drivers compliant without extra paperwork.",
    cta: "Compare ELD options",
  },
};

interface CarrierSignals {
  totalVehicles: number | null;
  inspectionsTotal: number;
  violationsTotal: number;
  hasSafetyAlert: boolean;
}

/** Violations per inspection at which a record reads as a real problem. */
const POOR_VIOLATION_RATE = 2;

/** Fleet size at or below which cash flow tends to matter more than scale. */
const SMALL_FLEET = 10;

/**
 * Pick the two most relevant categories for this carrier.
 *
 * Intent differs sharply by profile: a one-truck operator cares about cash flow,
 * while a carrier sitting on open BASIC alerts cares about getting out of them.
 *
 * Note the rate rather than the raw count — nearly every carrier that has ever
 * been inspected has *some* violation on file, so `violations > 0` would route
 * essentially the whole directory to the same offer.
 */
function rankCategories({
  totalVehicles,
  inspectionsTotal,
  violationsTotal,
  hasSafetyAlert,
}: CarrierSignals): AffiliateCategory[] {
  const violationRate =
    inspectionsTotal > 0 ? violationsTotal / inspectionsTotal : 0;

  if (hasSafetyAlert || violationRate >= POOR_VIOLATION_RATE) {
    return ["compliance", "insurance", "eld", "factoring"];
  }
  if (totalVehicles !== null && totalVehicles <= SMALL_FLEET) {
    return ["factoring", "insurance", "eld", "compliance"];
  }
  return ["insurance", "eld", "compliance", "factoring"];
}

export function selectOffers(
  signals: CarrierSignals,
  limit = 2,
): AffiliateOffer[] {
  return rankCategories(signals)
    .map((category) => {
      const url = PARTNER_URLS[category];
      return url ? { ...CATALOG[category], url } : null;
    })
    .filter((offer): offer is AffiliateOffer => offer !== null)
    .slice(0, limit);
}
