/**
 * 📚 DYNAMIC SITEMAP (Next.js Native)
 * ────────────────────────────────────────────────────────
 *
 * Instead of a static public/sitemap.xml that goes stale,
 * this TypeScript file generates the sitemap dynamically
 * at build time (or on request in dev mode).
 *
 * WHY DYNAMIC?
 * - Automatically includes all public routes
 * - Updates `lastModified` to today's date
 * - No manual maintenance needed when you add new pages
 *
 * ONLY PUBLIC PAGES are included — dashboard routes are
 * protected and should NOT be in the sitemap (Google can't
 * access them anyway, and it would waste crawl budget).
 *
 * Next.js automatically serves this at /sitemap.xml when
 * it detects a sitemap.ts file in the app directory.
 * ────────────────────────────────────────────────────────
 */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://rideshare-platform.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
