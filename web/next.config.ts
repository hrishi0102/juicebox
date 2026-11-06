import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local-first app: pages read the user's own data on every request.
  serverExternalPackages: ["@0gfoundation/0g-compute-ts-sdk", "ethers"],
  // Demo data is read with fs at runtime; make sure a hosted deploy ships it.
  outputFileTracingIncludes: { "/**": ["./fixtures/demo/**/*"], "/api/card": ["./assets/fonts/*"], "/api/card/swarm": ["./assets/fonts/*"] },
  // Old addresses from before the app was split into the company side, My week, and For fun.
  async redirects() {
    return [
      { source: "/org", destination: "/company", permanent: false },
      { source: "/team", destination: "/company/team", permanent: false },
      { source: "/sessions", destination: "/me/sessions", permanent: false },
      { source: "/sessions/:id", destination: "/me/sessions/:id", permanent: false },
      { source: "/share", destination: "/card", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
