"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import SpeciesLink from "@/components/species-panel/SpeciesLink";
import MonthSelector, { MONTHS, MONTH_SEASON } from "./MonthSelector";
import { blurDataURL } from "@/lib/image-utils";
import type { SeasonalGuide as SeasonalGuideType } from "@/lib/types";

const SEASON_LABELS: Record<string, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

const SEASON_ICONS: Record<string, string> = {
  winter: "❄️",
  spring: "🌱",
  summer: "☀️",
  fall: "🍂",
};

const INITIAL_SPECIES = 6;
const LOAD_MORE_COUNT = 6;

export default function SeasonalGuide({ guide }: { guide: SeasonalGuideType | null }) {
  // Auto-detect current month
  const currentMonthIndex = new Date().getMonth();
  const currentMonthKey = MONTHS[currentMonthIndex].key;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [expandedHighlights, setExpandedHighlights] = useState<Record<string, number>>({});

  const availableMonths = useMemo(() => {
    if (!guide) return [];
    return Object.keys(guide.months);
  }, [guide]);

  const monthData = guide?.months[selectedMonth];
  const season = MONTH_SEASON[selectedMonth];

  if (!guide || availableMonths.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-lg">Seasonal guide data is not yet available.</p>
        <p className="text-sm mt-2">Run the trait classification pipeline first.</p>
      </div>
    );
  }

  function getVisibleCount(feature: string) {
    return expandedHighlights[feature] || INITIAL_SPECIES;
  }

  function showMore(feature: string) {
    setExpandedHighlights((prev) => ({
      ...prev,
      [feature]: (prev[feature] || INITIAL_SPECIES) + LOAD_MORE_COUNT,
    }));
  }

  return (
    <div>
      {/* Current season banner */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{SEASON_ICONS[season]}</span>
          <div>
            <h2 className="font-serif text-xl font-bold text-text-primary">
              {MONTHS.find((m) => m.key === selectedMonth)?.label} — {SEASON_LABELS[season]}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {monthData?.highlights.length || 0} things to look for this month
            </p>
          </div>
        </div>
      </div>

      {/* Month selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onSelect={(m) => {
          setSelectedMonth(m);
          setExpandedHighlights({});
        }}
      />

      {/* Highlight sections */}
      {!monthData || monthData.highlights.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No highlights for this month yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthData.highlights.map((highlight) => {
            const visibleCount = getVisibleCount(highlight.feature);
            const visibleSpecies = highlight.species.slice(0, visibleCount);
            const hasMore = visibleCount < highlight.species.length;

            return (
              <section key={highlight.feature}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl shrink-0">{highlight.icon}</span>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-text-primary">
                      {highlight.feature}
                    </h3>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {highlight.description}
                    </p>
                  </div>
                  <span className="shrink-0 ml-auto text-sm font-ui text-text-muted">
                    {highlight.species.length} species
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleSpecies.map((sp) => (
                    <SpeciesLink
                      key={sp.slug}
                      slug={sp.slug}
                      className="group flex gap-3 bg-card border border-border rounded-xl p-3 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-cream-dark">
                        {sp.thumbnailUrl ? (
                          <Image
                            src={sp.thumbnailUrl}
                            alt={sp.commonName}
                            fill
                            className="object-cover"
                            sizes="64px"
                            placeholder="blur"
                            blurDataURL={blurDataURL}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-text-muted text-xs">
                            No photo
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors truncate">
                          {sp.commonName}
                        </h4>
                        <p className="italic text-xs text-text-secondary truncate">
                          {sp.scientificName}
                        </p>
                        {sp.note && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">
                            {sp.note}
                          </p>
                        )}
                      </div>
                    </SpeciesLink>
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center mt-3">
                    <button
                      onClick={() => showMore(highlight.feature)}
                      className="text-sm font-ui text-forest hover:text-forest-light transition-colors"
                    >
                      Show more ({highlight.species.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
