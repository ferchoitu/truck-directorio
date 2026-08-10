// The public canonical origin, hardcoded on purpose.
//
// This value ends up in <link rel="canonical"> and in every JSON-LD `item`/`url`.
// It used to be read from NEXT_PUBLIC_SITE_URL, and the deployed environment had
// it pointing at the truck-directorio.vercel.app host: every yotruck.com page
// declared a canonical on a different domain, so Google discarded it and filed
// the pages under "Duplicate without user-selected canonical". There is no
// legitimate deploy of this app that should canonicalize anywhere else, so the
// override is gone.
export const SITE_URL = "https://www.yotruck.com";
