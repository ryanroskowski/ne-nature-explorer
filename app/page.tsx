import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCommonality } from "@/lib/data/commonality";
import { getTaxonomyTree } from "@/lib/data/taxonomy";
import { getContextualArticles } from "@/lib/data/articles";
import { getAvailableGroups } from "@/lib/data/groups";
import SpeciesCard from "@/components/ui/SpeciesCard";
import GroupIcon from "@/components/ui/GroupIcon";

// Explicit canonical keeps Google from picking a trailing-slash or
// query-param variant as the canonical version of the homepage.
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

/** All potential groups in display order, with icons for the "coming soon" state */
const ALL_GROUP_DISPLAY = [
  { key: "plants", name: "Plants", icon: "🌿" },
  { key: "fungi", name: "Fungi", icon: "🍄" },
  { key: "birds", name: "Birds", icon: "🐦" },
  { key: "mammals", name: "Mammals", icon: "🦌" },
  { key: "reptiles", name: "Reptiles", icon: "🐍" },
  { key: "amphibians", name: "Amphibians", icon: "🐸" },
  { key: "insects", name: "Insects", icon: "🦋" },
  { key: "lichens", name: "Lichens", icon: "🌱" },
  { key: "arachnids", name: "Arachnids", icon: "🕷️" },
  { key: "mollusks", name: "Mollusks", icon: "🐚" },
  { key: "fish", name: "Fish", icon: "🐟" },
  { key: "crustaceans", name: "Crustaceans", icon: "🦀" },
  { key: "myriapods", name: "Myriapods", icon: "🐛" },
  { key: "cnidarians", name: "Cnidarians", icon: "🌊" },
  { key: "echinoderms", name: "Echinoderms", icon: "⭐" },
];

export default function HomePage() {
  const commonality = getCommonality("plants");
  const tree = getTaxonomyTree("plants");
  const topSpecies = commonality.slice(0, 6);
  const totalFamilies = new Set(commonality.map((s) => s.family)).size;
  const allArticles = getContextualArticles();
  // Match the display order from the Learn page
  const articleDisplayOrder = [
    "reading-tree-bark", "winter-tree-id-buds-twigs", "trees-vs-shrubs",
    "conifer-families", "cedar-confusion", "hemlock-tree-vs-poison",
    "fern-id-beginners", "bird-song-basics", "reading-animal-signs", "spring-ephemerals", "pollinator-scouting",
    "vernal-pools", "night-sounds", "tidepool-life", "reading-a-pond", "dragonflies-damselflies", "beach-wrack-line", "edible-toxic-lookalikes", "mushroom-foraging-101", "native-plants-vs-nursery",
    "succession", "stone-walls-forest-history", "decomposers",
    "mycorrhizal-networks", "invasive-species", "bogs-fens-swamps", "edge-effects", "phenology-natures-calendar", "fire-in-new-england",
    "evolutionary-timeline", "lichen-symbiosis", "parasitic-plants-fungi",
    "epiphytes-of-new-england", "galls", "fall-foliage-chemistry",
    "seaweed-marine-algae", "moss-overlooked-kingdom",
  ];
  const articleMap = new Map(allArticles.map((a) => [a.slug, a]));
  const articles = articleDisplayOrder
    .map((slug) => articleMap.get(slug))
    .filter((a): a is NonNullable<typeof a> => a != null);

  // Build dynamic categories from groups.json
  const availableGroups = getAvailableGroups();
  const activeGroupKeys = new Set(availableGroups.filter(g => g.status === "active").map(g => g.key));
  const activeGroupMap = new Map(availableGroups.map(g => [g.key, g]));
  const totalSpecies = availableGroups.reduce((sum, g) => sum + g.speciesCount, 0);

  const categories = ALL_GROUP_DISPLAY.map((gd) => {
    const info = activeGroupMap.get(gd.key);
    const isActive = activeGroupKeys.has(gd.key);
    return {
      key: gd.key,
      name: info?.label || gd.name,
      icon: info?.icon || gd.icon,
      status: isActive ? ("active" as const) : ("coming" as const),
      href: isActive ? `/explore?group=${gd.key}` : "#",
      speciesCount: info?.speciesCount || 0,
    };
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-forest-dark to-forest py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 L35 20 L30 15 L25 20 Z' fill='%23ffffff' opacity='0.3'/%3E%3C/svg%3E")`,
            backgroundSize: "60px 60px",
          }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            Discover the Living World of New England
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8 font-body">
            An interactive field guide to the plants, fungi, and wildlife
            around you. Learn to identify, explore, and wonder.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/common"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-forest font-ui font-semibold rounded-xl hover:bg-white/90 transition-colors"
            >
              🌱 Start Learning
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/15 text-white border border-white/20 font-ui font-semibold rounded-xl hover:bg-white/25 transition-colors"
            >
              🌳 Explore the Tree of Life
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-card border-b border-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm font-ui text-text-secondary">
          <div className="text-center">
            <span className="block text-xl sm:text-2xl font-bold text-text-primary font-serif">
              {totalSpecies.toLocaleString()}
            </span>
            species
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center">
            <span className="block text-xl sm:text-2xl font-bold text-text-primary font-serif">
              {totalFamilies}
            </span>
            families
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center">
            <span className="block text-xl sm:text-2xl font-bold text-text-primary font-serif">
              6
            </span>
            states
          </div>
        </div>
      </section>

      {/* Ways to Explore */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="font-serif text-2xl font-bold text-text-primary text-center mb-6">
          Ways to Explore
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/browse/traits"
            className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <span className="text-2xl shrink-0">🌲</span>
            <div>
              <span className="font-ui font-semibold text-sm text-text-primary group-hover:text-forest transition-colors">
                By Plant Type
              </span>
              <span className="block text-xs text-text-muted">
                Trees, shrubs, ferns & more
              </span>
            </div>
          </Link>
          <Link
            href="/browse/flowers"
            className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <span className="text-2xl shrink-0">🌸</span>
            <div>
              <span className="font-ui font-semibold text-sm text-text-primary group-hover:text-forest transition-colors">
                By Flower
              </span>
              <span className="block text-xs text-text-muted">
                Color, shape & bloom season
              </span>
            </div>
          </Link>
          <Link
            href="/browse/monthly"
            className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <span className="text-2xl shrink-0">📅</span>
            <div>
              <span className="font-ui font-semibold text-sm text-text-primary group-hover:text-forest transition-colors">
                What&apos;s Happening Now
              </span>
              <span className="block text-xs text-text-muted">
                Month-by-month field guide
              </span>
            </div>
          </Link>
          <Link
            href="/map"
            className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <span className="text-2xl shrink-0">🗺️</span>
            <div>
              <span className="font-ui font-semibold text-sm text-text-primary group-hover:text-forest transition-colors">
                Nature Map
              </span>
              <span className="block text-xs text-text-muted">
                Find areas near you to explore
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="font-serif text-2xl font-bold text-text-primary text-center mb-8">
          What would you like to explore?
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all duration-200 ${
                cat.status === "active"
                  ? "bg-card border-forest/20 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  : "bg-cream-dark border-border opacity-60 cursor-default"
              }`}
            >
              <GroupIcon groupKey={cat.key} emoji={cat.icon} size={32} />
              <span className="font-ui font-semibold text-sm text-text-primary">
                {cat.name}
              </span>
              {cat.status === "active" ? (
                <span className="text-xs font-ui text-forest">
                  {cat.speciesCount.toLocaleString()} species
                </span>
              ) : (
                <span className="text-xs font-ui text-text-muted">
                  Coming soon
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Most Common Species */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-text-primary">
            Most Common Species
          </h2>
          <Link
            href="/common"
            className="text-sm font-ui text-forest hover:text-forest-light transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topSpecies.map((species, i) => (
            <SpeciesCard
              key={species.slug}
              slug={species.slug}
              commonName={species.commonName}
              scientificName={species.scientificName}
              family={species.family}
              thumbnailUrl={species.thumbnailUrl}
              photos={species.photos}
              abundanceTier={species.abundanceTier}
              priority={i < 3}
            />
          ))}
        </div>
      </section>

      {/* Learn section */}
      {articles.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-text-primary">
              Good to Know
            </h2>
            <Link
              href="/learn"
              className="text-sm font-ui text-forest hover:text-forest-light transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/learn/${article.slug}`}
                className="group block bg-card border border-border rounded-2xl p-5 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <span className="text-2xl block mb-2" aria-hidden="true">
                  {article.icon}
                </span>
                <h3 className="font-serif font-semibold text-text-primary group-hover:text-forest transition-colors text-sm">
                  {article.title}
                </h3>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {article.subtitle}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Call to action */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-3">
            Ready to explore?
          </h2>
          <p className="text-text-secondary mb-6 max-w-xl mx-auto">
            Start with the most common species and work your way through the
            tree of life. Every walk outside becomes a discovery.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/common"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-forest text-white font-ui font-medium rounded-xl hover:bg-forest-light transition-colors"
            >
              Browse by Commonality
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-card border border-border text-text-primary font-ui font-medium rounded-xl hover:bg-cream-dark transition-colors"
            >
              Explore the Tree of Life
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
