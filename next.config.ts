import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: process.env.DEV_TUNNEL_HOST ? [process.env.DEV_TUNNEL_HOST] : undefined,
  // Dynamic build directory based on port to prevent compilation clash in dev mode
  distDir: process.env.ADMIN_PORT ? ".next-admin" : (process.env.USER_PORT ? ".next-user" : ".next"),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.wallpapersafari.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Ignore ESLint & TypeScript errors DURING build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Reduce bundle size
  productionBrowserSourceMaps: false,

  // Optimize package imports (useful for lucide icons)
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // One public origin for the dashboard, API and OAuth browser cookies.
  // Opt in locally; deployments with a separate API keep their existing routing.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
    return {
      beforeFiles: target ? [
        { source: "/v1/:path*", destination: `${target}/v1/:path*` },
        { source: "/uploads/:path*", destination: `${target}/uploads/:path*` },
        { source: "/live", destination: `${target}/live` },
      ] : [],
      afterFiles: [],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NODE_ENV === "development" ? "*" : "https://app.soft7.in",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
