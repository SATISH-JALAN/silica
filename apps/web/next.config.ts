import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // let the dev server serve assets when opened via 127.0.0.1 as well as localhost
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
