"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import SpeciesCard from "@/components/ui/SpeciesCard";
import SpeciesLink from "@/components/species-panel/SpeciesLink";
import FamilyFilter from "./FamilyFilter";
import { blurDataURL } from "@/lib/image-utils";
import type { CommonalityEntry, AbundanceTier } from "@/lib/types";

const INITIAL_VISIBLE = 24;
const LOAD_MORE_COUNT = 24;

const tierInfo: {
  tier: AbundanceTier;
  label: string;
  description: string;
  icon: string;
  gridCols: string;
}[] = [
  {
    tier: "very-common",
    label: "Very Common",
    description: "You'll encounter these regularly on any nature walk",
    icon: "🌟",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5",
  },
  {
    tier: "common",
    label: "Common",
    description: "Frequently seen throughout the region",
    icon: "✨",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
  },
  {
    tier: "moderate",
    label: "Moderate",
    description: "Present but not seen on every outing",
    icon: "🔹",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
  },
  {
    tier: "uncommon",
    label: "Uncommon",
    description: "Takes some looking to find these",
    icon: "🔸",
    gridCols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3",
  },
  {
    tier: "rare",
    label: "Rare",
    description: "Unusual finds — keep an eye out!",
    icon: "💎",
    gridCols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3",
  },
];

// Card size by tier: very-common gets large, common/moderate default, uncommon/rare compact
function getCardSize(tier: AbundanceTier): "large" | "default" | "compact" {
  if (tier === "very-common") return "large";
  if (tier === "uncommon" || tier === "rare") return "compact";
  return "default";
}

export default function CommonalityBrowser({
  species,
}: {
  species: CommonalityEntry[];
}) {
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    () => {
      const counts: Record<string, number> = {};
      for (const t of tierInfo) counts[t.tier] = INITIAL_VISIBLE;
      return counts;
    }
  );

  // Get unique families with their common names and counts
  const families = useMemo(() => {
    const famMap = new Map<string, { commonName: string; count: number }>();
    for (const s of species) {
      const existing = famMap.get(s.family);
      if (existing) {
        existing.count++;
      } else {
        famMap.set(s.family, {
          commonName: s.familyCommonName || s.family,
          count: 1,
        });
      }
    }
    return Array.from(famMap.entries())
      .map(([family, { commonName, count }]) => ({ family, commonName, count }))
      .sort((a, b) => a.commonName.localeCompare(b.commonName));
  }, [species]);

  // Filter species
  const filtered = useMemo(() => {
    if (familyFilter === "all") return species;
    return species.filter((s) => s.family === familyFilter);
  }, [species, familyFilter]);

  // Group by tier
  const grouped = useMemo(() => {
    const map = new Map<AbundanceTier, CommonalityEntry[]>();
    for (const s of filtered) {
      if (!map.has(s.abundanceTier)) map.set(s.abundanceTier, []);
      map.get(s.abundanceTier)!.push(s);
    }
    return map;
  }, [filtered]);

  // Reset visible counts when filter changes
  const handleFilterChange = useCallback((family: string) => {
    setFamilyFilter(family);
    setVisibleCounts(() => {
      const counts: Record<string, number> = {};
      for (const t of tierInfo) counts[t.tier] = INITIAL_VISIBLE;
      return counts;
    });
  }, []);

  // Top species for "Start Here" — take from most-observed, only when showing all
  const startHereSpecies = useMemo(() => {
    if (familyFilter !== "all") return [];
    return species.slice(0, Math.min(6, species.length));
  }, [species, familyFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <FamilyFilter
          families={families}
          totalCount={species.length}
          selected={familyFilter}
          onSelect={handleFilterChange}
        />
        {familyFilter !== "all" && (
          <button
            onClick={() => handleFilterChange("all")}
            className="text-sm font-ui text-forest hover:text-forest-light transition-colors underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Start Here section */}
      {startHereSpecies.length > 0 && (
        <section className="mb-12">
          <div className="bg-forest/5 border border-forest/15 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-serif text-xl font-bold text-forest">
                Start Here
              </h2>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              New to New England plants? These are the most commonly
              encountered species — learn these first and you&apos;ll recognize
              what you see on most walks.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {startHereSpecies.map((s, i) => (
                <SpeciesLink
                  key={s.slug}
                  slug={s.slug}
                  className="group block bg-card rounded-xl border border-border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-24 sm:h-28 overflow-hidden bg-cream-dark">
                    {s.thumbnailUrl ? (
                      <Image
                        src={s.thumbnailUrl}
                        alt={s.commonName}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 16vw"
                        placeholder="blur"
                        blurDataURL={blurDataURL}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-text-muted">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 bg-forest/90 text-white text-xs font-ui font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {i + 1}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <span className="font-serif text-sm font-semibold text-text-primary group-hover:text-forest transition-colors capitalize leading-tight block">
                      {s.commonName}
                    </span>
                    <span className="text-xs italic text-text-secondary block mt-0.5">
                      {s.scientificName}
                    </span>
                  </div>
                </SpeciesLink>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tier sections */}
      {tierInfo.map(({ tier, label, description, icon, gridCols }) => {
        const tierSpecies = grouped.get(tier);
        if (!tierSpecies || tierSpecies.length === 0) return null;
        const cardSize = getCardSize(tier);
        const visible = visibleCounts[tier] || INITIAL_VISIBLE;
        const visibleSpecies = tierSpecies.slice(0, visible);
        const hasMore = visible < tierSpecies.length;
        const remaining = tierSpecies.length - visible;

        return (
          <section key={tier} className="mb-12">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{icon}</span>
              <h2 className="font-serif text-xl font-bold text-text-primary">
                {label}
              </h2>
              <span className="text-sm font-ui text-text-muted ml-1">
                ({tierSpecies.length} species)
              </span>
            </div>
            <p className="text-sm text-text-secondary mb-4">{description}</p>
            <div className={`grid ${gridCols}`}>
              {visibleSpecies.map((s) => (
                <SpeciesCard
                  key={s.slug}
                  slug={s.slug}
                  commonName={s.commonName}
                  scientificName={s.scientificName}
                  family={s.family}
                  thumbnailUrl={s.thumbnailUrl}
                  abundanceTier={s.abundanceTier}
                  compact={cardSize === "compact"}
                  large={cardSize === "large"}
                  photos={s.photos}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-5">
                <button
                  onClick={() =>
                    setVisibleCounts((prev) => ({
                      ...prev,
                      [tier]: prev[tier] + LOAD_MORE_COUNT,
                    }))
                  }
                  className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-ui font-medium text-text-primary hover:bg-cream-dark hover:border-forest/30 transition-colors"
                >
                  Show {Math.min(LOAD_MORE_COUNT, remaining)} more
                  <span className="text-text-muted ml-1">
                    ({remaining} remaining)
                  </span>
                </button>
              </div>
            )}
          </section>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-text-secondary text-center py-12">
          No species found for this filter.
        </p>
      )}
    </div>
  );
}
