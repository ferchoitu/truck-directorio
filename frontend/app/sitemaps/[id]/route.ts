import { getCarrierSlugs } from "@/lib/api";
import { SITE_URL, SITEMAP_PAGE_SIZE, urlsetXml } from "@/lib/sitemap";
import { STATES } from "@/lib/states";

export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) {
    return new Response("Not found", { status: 404 });
  }

  let urls: string[];
  if (id === 0) {
    urls = [
      SITE_URL,
      `${SITE_URL}/search`,
      ...STATES.map((s) => `${SITE_URL}/state/${s.code.toLowerCase()}`),
    ];
  } else {
    const slugs = await getCarrierSlugs(id - 1, SITEMAP_PAGE_SIZE);
    if (!slugs || slugs.length === 0) {
      return new Response("Not found", { status: 404 });
    }
    urls = slugs.map((slug) => `${SITE_URL}/carrier/${slug}`);
  }

  return new Response(urlsetXml(urls), {
    headers: { "Content-Type": "application/xml" },
  });
}
