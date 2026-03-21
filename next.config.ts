import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "inaturalist-open-data.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "static.inaturalist.org",
      },
    ],
  },
  // Prevent Next.js from bundling huge data files into every serverless function.
  // Each page only needs its specific data module — not all 168MB of species JSON.
  outputFileTracingExcludes: {
    // No page needs the full species directory except species/[slug] itself
    "/api/search-index": ["./data/species/**", "./data/nature-areas*"],
    "/map": ["./data/species/**"],
    "/explore": ["./data/species/**", "./data/nature-areas*"],
    "/explore/[...path]": ["./data/species/**", "./data/nature-areas*"],
    "/browse": ["./data/species/**", "./data/nature-areas*"],
    "/browse/traits": ["./data/species/**", "./data/nature-areas*"],
    "/browse/flowers": ["./data/species/**", "./data/nature-areas*"],
    "/browse/seasonal": ["./data/species/**", "./data/nature-areas*"],
    "/browse/monthly": ["./data/species/**", "./data/nature-areas*"],
    "/common": ["./data/species/**", "./data/nature-areas*"],
    "/compare": ["./data/nature-areas*"],
    "/compare/[group]": ["./data/nature-areas*"],
    "/learn": ["./data/nature-areas*"],
    "/learn/[slug]": ["./data/nature-areas*"],
  },
};

export default nextConfig;
