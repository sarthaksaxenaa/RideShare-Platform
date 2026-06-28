import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from external domains
  images: {
    domains: ['localhost'],
  },
  // Suppress hydration warnings from Leaflet
  reactStrictMode: true,
};

export default nextConfig;
