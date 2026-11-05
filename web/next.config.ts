import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local-first app: pages read the user's own data on every request.
  serverExternalPackages: ["@0gfoundation/0g-compute-ts-sdk", "ethers"],
  // Demo data is read with fs at runtime; make sure a hosted deploy ships it.
  outputFileTracingIncludes: { "/**": ["./fixtures/demo/**/*"] },
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
