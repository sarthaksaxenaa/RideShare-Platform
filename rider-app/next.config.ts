import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from external domains
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Suppress hydration warnings from Leaflet
  reactStrictMode: true,
  // Hide the Next.js "N" dev indicator in bottom-left corner
  devIndicators: false,
};

export default nextConfig;
