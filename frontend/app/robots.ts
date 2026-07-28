import type { MetadataRoute } from "next";

// robots.txt must always advertise the production canonical sitemap.
const SITE_URL = "https://www.yotruck.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
