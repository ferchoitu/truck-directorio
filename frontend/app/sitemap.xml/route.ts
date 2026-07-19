import { getCarrierCount } from "@/lib/api";
import { indexXml, SITE_URL, SITEMAP_PAGE_SIZE } from "@/lib/sitemap";

export const revalidate = 86400;

export async function GET(): Promise<Response> {
  const total = await getCarrierCount();
  const carrierPages = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
  // Sitemap 0 holds static + state pages; 1..N hold carrier profiles.
  const urls = Array.from({ length: carrierPages + 1 }, (_, i) => `${SITE_URL}/sitemaps/${i}`);
  return new Response(indexXml(urls), {
    headers: { "Content-Type": "application/xml" },
  });
}
