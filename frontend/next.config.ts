import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // El prototipo renderiza en el cliente (estado en localStorage), así que solo se validan
  // los segmentos que declaren `instant` explícitamente.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  partialPrefetching: true,
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
