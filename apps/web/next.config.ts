import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // the shared package ships TypeScript source (ABIs, addresses, units, crypto)
  transpilePackages: ["@silica/shared"],
  // wagmi's connector bundle pulls @coinbase/cdp-sdk, whose optional x402 payment
  // modules aren't installed; Silica never uses them, so they resolve to a stub
  turbopack: {
    resolveAlias: Object.fromEntries(
      ["@x402/core/client", "@x402/evm", "@x402/evm/exact/client", "@x402/evm/upto/client", "@x402/svm/exact/client"].map((m) => [m, "./lib/stubs/empty.js"]),
    ),
  },
  // the VitePress docs are built into public/docs with clean URLs, so map them to their .html files
  async rewrites() {
    return [
      { source: "/docs", destination: "/docs/index.html" },
      { source: "/docs/:path*", destination: "/docs/:path*.html" },
    ];
  },
  // let the dev server serve assets when opened via 127.0.0.1 as well as localhost
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
