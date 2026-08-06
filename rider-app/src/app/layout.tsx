import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * 📚 metadataBase
 * Sets the canonical base URL for the entire site. Next.js uses
 * this to:
 *  - Generate absolute URLs for OG images (relative paths like
 *    '/og-image.jpg' become 'https://domain.com/og-image.jpg')
 *  - Set the canonical <link> tag (tells Google "this is the
 *    real URL, don't index duplicates")
 *
 * Without this, social platforms can't resolve relative image paths.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://rideshare-platform.vercel.app'),
  title: {
    default: 'RideShare — Real-Time Ride Hailing Platform',
    template: '%s | RideShare',  // Per-page titles become "Page Name | RideShare"
  },
  description:
    'Book rides instantly with real-time GPS tracking, Stripe payments, and intelligent driver matching. Built with Next.js, Socket.io, and Prisma.',
  keywords: [
    'ride hailing', 'cab booking', 'real-time tracking', 'socket.io',
    'next.js', 'stripe payments', 'rideshare', 'transportation app',
  ],
  authors: [{ name: 'Sarthak Saxena' }],
  creator: 'Sarthak Saxena',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',

  /**
   * 📚 Open Graph Tags
   * The Open Graph protocol (created by Facebook) tells social
   * platforms how to display your link when shared. Without these,
   * sharing your URL on LinkedIn/WhatsApp shows a plain text link.
   * With them, it shows a rich card with image, title, description.
   *
   * og:type = 'website' tells platforms this is a general website
   * (vs 'article', 'product', etc.)
   */
  openGraph: {
    title: 'RideShare — Real-Time Ride Hailing Platform',
    description: 'Book rides instantly with real-time GPS tracking, Stripe payments, and intelligent driver matching.',
    url: 'https://rideshare-platform.vercel.app',
    siteName: 'RideShare',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'RideShare — Real-Time Ride Hailing Platform',
      },
    ],
  },

  /**
   * 📚 Twitter Card Tags
   * Twitter has its own meta tag system (separate from OG).
   * 'summary_large_image' shows a big image card instead of a
   * small thumbnail — much more visually impactful.
   */
  twitter: {
    card: 'summary_large_image',
    title: 'RideShare — Real-Time Ride Hailing Platform',
    description: 'Book rides instantly with real-time GPS tracking, Stripe payments, and intelligent driver matching.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RideShare" />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900 min-h-screen">
        <Providers>{children}</Providers>
      </body>
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          });
        }
      `}} />
    </html>
  );
}
