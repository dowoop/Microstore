import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://devnet.helius-rpc.com https://mainnet.helius-rpc.com http://localhost:18103 http://18.217.22.26:12502 http://localhost:12502 https://indexer.tari.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;