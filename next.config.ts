import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake large icon libraries by optimizing barrel imports
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable gzip/brotli compression
  compress: true,

  // Images come from arbitrary sources (blob, data URIs, external URLs)
  // — we use next/Image with unoptimized per-instance
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
