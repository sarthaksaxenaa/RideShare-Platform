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
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'RideShare — Book rides instantly',
  description:
    'Real-time rides, real-time trust. Book your next ride instantly with RideShare.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
