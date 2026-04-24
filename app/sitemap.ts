import type { MetadataRoute } from "next";
import { getAllSpeciesSlugs } from "@/lib/data/species";
import { getContextualArticles } from "@/lib/data/articles";

// Keep in sync with generateStaticParams in app/compare/[group]/page.tsx.
// That route has `dynamicParams = false`, so only these slugs resolve —
// the sitemap must not advertise arbitrary genus slugs or Google sees
// a wave of 404s. (Previous bug: sitemap listed every genus, but the
// compare route only pre-builds these 15 group slugs.)
const COMPARE_GROUP_SLUGS = [
  "plants",
  "mammals",
  "amphibians",
  "reptiles",
  "birds",
  "lichens",
  "fungi",
  "insects",
  "arachnids",
  "fish",
  "mollusks",
  "crustaceans",
  "cnidarians",
  "myriapods",
  "echinoderms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ne-nature-explorer.vercel.app";

  const speciesSlugs = getAllSpeciesSlugs();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/common`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/identify`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Browse sub-pages. Each page has a canonical pointing to the bare
  // path (see app/browse/*/page.tsx) — the ?group=… query is just UI
  // state, so listing per-group URLs in the sitemap just bloats it
  // with duplicates that all resolve to the same canonical.
  const browsePages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/browse/traits`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/browse/flowers`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/browse/monthly`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/browse/seasonal`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ];

  const speciesPages: MetadataRoute.Sitemap = speciesSlugs.map((slug) => ({
    url: `${baseUrl}/species/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const comparePages: MetadataRoute.Sitemap = COMPARE_GROUP_SLUGS.map(
    (group) => ({
      url: `${baseUrl}/compare/${group}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  const articles = getContextualArticles();
  const learnPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...articles.map((a) => ({
      url: `${baseUrl}/learn/${a.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [...staticPages, ...browsePages, ...speciesPages, ...comparePages, ...learnPages];
}
