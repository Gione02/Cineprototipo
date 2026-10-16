import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // El prototipo renderiza en el cliente (estado en localStorage), así que solo se validan
  // los segmentos que declaren `instant` explícitamente.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  partialPrefetching: true,
  // next/image: los pósters (JPG/PNG de hasta 180 KB) se sirven en AVIF o WebP y al tamaño en que se muestran.
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75], // obligatorio desde Next 16: sólo estas calidades se pueden pedir
    localPatterns: [{ pathname: "/posters/**", search: "" }],
    minimumCacheTTL: 2678400, // 31 días: los pósters no cambian
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
