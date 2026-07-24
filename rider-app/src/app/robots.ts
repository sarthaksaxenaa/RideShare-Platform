/**
 * 📚 DYNAMIC ROBOTS.TS (Next.js Native)
 * ────────────────────────────────────────────────────────
 *
 * Like the dynamic sitemap, this replaces the static
 * public/robots.txt with a TypeScript function.
 *
 * ADVANTAGE: We can conditionally block crawling in
 * staging/preview environments by checking NODE_ENV,
 * preventing Google from indexing your Vercel preview URLs.
 *
 * Next.js serves this at /robots.txt automatically.
 * ────────────────────────────────────────────────────────
 */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://rideshare-platform.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: ['/dashboard', '/dashboard/*', '/api'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
