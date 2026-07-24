/**
 * 📚 LOGIN ROUTE LAYOUT — Per-Page Metadata
 * ────────────────────────────────────────────────────────
 *
 * Since login/page.tsx is a 'use client' component, it can't
 * export metadata. This layout.tsx (a server component by
 * default) exports the metadata on its behalf.
 *
 * Next.js MERGES metadata from parent layouts → child layouts.
 * So the root layout's OG image and base URL are inherited,
 * and we only need to override title + description here.
 *
 * The `title` string "Login" becomes "Login | RideShare"
 * because the root layout has `template: '%s | RideShare'`.
 * ────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description:
    'Sign in or create your RideShare account. Book rides instantly as a rider, start earning as a driver, or manage the platform as an admin.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
