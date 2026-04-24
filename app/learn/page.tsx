import Link from "next/link";
import { getContextualArticles } from "@/lib/data/articles";
import { getSpecies } from "@/lib/data/species";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Dive deeper into the world of New England botany. Articles on naming confusion, family identification, and more.",
  alternates: {
    canonical: "/learn",
  },
};

// Define display order by category
const articleOrder: { category: string; slugs: string[] }[] = [
  {
    category: "Tree & Plant Identification",
    slugs: [
      "reading-tree-bark",
      "winter-tree-id-buds-twigs",
      "trees-vs-shrubs",
      "conifer-families",
      "cedar-confusion",
      "hemlock-tree-vs-poison",
      "fern-id-beginners",
    ],
  },
  {
    category: "Field Skills & Observation",
    slugs: [
      "bird-song-basics",
      "reading-animal-signs",
      "spring-ephemerals",
      "pollinator-scouting",
      "vernal-pools",
      "night-sounds",
      "tidepool-life",
      "reading-a-pond",
      "dragonflies-damselflies",
      "beach-wrack-line",
      "edible-toxic-lookalikes",
      "mushroom-foraging-101",
      "native-plants-vs-nursery",
    ],
  },
  {
    category: "Ecology & Natural History",
    slugs: [
      "succession",
      "stone-walls-forest-history",
      "decomposers",
      "mycorrhizal-networks",
      "invasive-species",
      "bogs-fens-swamps",
      "edge-effects",
      "phenology-natures-calendar",
      "fire-in-new-england",
    ],
  },
  {
    category: "Biology & Relationships",
    slugs: [
      "evolutionary-timeline",
      "lichen-symbiosis",
      "parasitic-plants-fungi",
      "epiphytes-of-new-england",
      "galls",
      "fall-foliage-chemistry",
      "seaweed-marine-algae",
      "moss-overlooked-kingdom",
    ],
  },
];

const categoryIcons: Record<string, string> = {
  "Tree & Plant Identification": "🌲",
  "Field Skills & Observation": "🐾",
  "Ecology & Natural History": "🌿",
  "Biology & Relationships": "🔬",
};

export default function LearnPage() {
  const articles = getContextualArticles();
  const articleMap = new Map(articles.map((a) => [a.slug, a]));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Learn", rank: "page", slug: "learn" },
        ]}
      />

      <header className="mb-10">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Good to Know
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          Dive deeper into New England&apos;s nature with practical field
          guides, ecological concepts, and the kind of context that makes
          everything click.
        </p>
      </header>

      {articleOrder.map((group) => (
        <section key={group.category} className="mb-10">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span aria-hidden="true">{categoryIcons[group.category]}</span>
            {group.category}
          </h2>
          <div className="space-y-4">
            {group.slugs.map((slug) => {
              const article = articleMap.get(slug);
              if (!article) return null;

              return (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="group block bg-card border border-border rounded-2xl p-5 sm:p-6 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="text-3xl shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      {article.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl font-bold text-text-primary group-hover:text-forest transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        {article.subtitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-xs font-ui text-text-muted">
                          Related:
                        </span>
                        {article.relatedSpeciesSlugs.map((s) => {
                          const sp = getSpecies(s);
                          return sp ? (
                            <span
                              key={s}
                              className="text-xs font-ui text-forest bg-forest/5 px-2 py-0.5 rounded-full"
                            >
                              {sp.commonName}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-text-muted shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {articles.length === 0 && (
        <p className="text-text-secondary text-center py-12">
          No articles yet. Check back soon!
        </p>
      )}
    </div>
  );
}
