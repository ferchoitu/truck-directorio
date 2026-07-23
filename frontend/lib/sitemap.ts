export const SITEMAP_PAGE_SIZE = 50_000;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yotruck.com";

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function urlsetXml(urls: string[]): string {
  const entries = urls
    .map((u) => `<url><loc>${xmlEscape(u)}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export function indexXml(sitemapUrls: string[]): string {
  const entries = sitemapUrls
    .map((u) => `<sitemap><loc>${xmlEscape(u)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}
