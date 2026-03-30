import type { MetadataRoute } from "next";
import { getAllSpeciesSlugs } from "@/lib/data/species";
import { getCommonality } from "@/lib/data/commonality";
import { getContextualArticles } from "@/lib/data/articles";
import { getAvailableGroups } from "@/lib/data/groups";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ne-nature-explorer.vercel.app";

  const speciesSlugs = getAllSpeciesSlugs();
  const commonality = getCommonality();
  const groups = getAvailableGroups().filter((g) => g.status === "active");

  // Collect unique genera for compare pages
  const genera = new Set<string>();
  for (const s of commonality) {
    genera.add(s.scientificName.split(" ")[0].toLowerCase());
  }

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
  ];

  // Browse pages per group (traits, flowers, monthly, seasonal)
  const browsePages: MetadataRoute.Sitemap = groups.flatMap((g) => [
    {
      url: `${baseUrl}/browse/traits?group=${g.key}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/browse/monthly?group=${g.key}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/browse/seasonal?group=${g.key}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ]);

  const speciesPages: MetadataRoute.Sitemap = speciesSlugs.map((slug) => ({
    url: `${baseUrl}/species/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const comparePages: MetadataRoute.Sitemap = Array.from(genera).map(
    (genus) => ({
      url: `${baseUrl}/compare/${genus}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
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
