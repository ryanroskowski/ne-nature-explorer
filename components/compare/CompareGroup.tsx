"use client";

import { useState } from "react";
import CompareSpeciesCard from "./CompareSpeciesCard";
import CompareTable from "./CompareTable";
import type { SpeciesData, AbundanceTier, SpeciesPhoto } from "@/lib/types";

interface CompareGroupProps {
  group: {
    genus: string;
    genusCommonName: string;
    family: string;
    familyCommonName: string;
    compareHints: string;
    species: {
      slug: string;
      commonName: string;
      scientificName: string;
      family: string;
      familyCommonName: string;
      abundanceTier: AbundanceTier;
      observationCount: number;
      habitat: string;
      funFact: string;
      idTips: { label: string; description: string; isPrimary?: boolean }[];
      photos: SpeciesPhoto[];
    }[];
  };
}

const INITIAL_VISIBLE = 6;
const LOAD_MORE_COUNT = 6;

export default function CompareGroup({ group }: CompareGroupProps) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const hasMore = visibleCount < group.species.length;
  const remaining = group.species.length - visibleCount;
  const visibleSpecies = group.species.slice(0, visibleCount);

  return (
    <section id={group.genus.toLowerCase()} className="mb-14 scroll-mt-20">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-xl font-bold text-text-primary capitalize">
              {group.genusCommonName}
            </h2>
            <span className="text-sm italic text-text-secondary">
              {group.genus}
            </span>
            <span className="text-sm font-ui text-text-muted">
              {group.species.length} species
            </span>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-cream-dark rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1 rounded-md text-xs font-ui font-medium transition-colors ${
              view === "grid"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="hidden sm:inline">Cards</span>
            <span className="sm:hidden">🃏</span>
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-md text-xs font-ui font-medium transition-colors ${
              view === "table"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="hidden sm:inline">Table</span>
            <span className="sm:hidden">📊</span>
          </button>
        </div>
      </div>

      {/* How to Tell Them Apart callout */}
      {group.compareHints && (
        <div className="bg-forest/5 border border-forest/15 rounded-xl px-4 py-3 mb-5">
          <h3 className="text-sm font-ui font-semibold text-forest mb-1">
            How to Tell Them Apart
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {group.compareHints}
          </p>
        </div>
      )}

      {view === "grid" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleSpecies.map((s) => (
              <CompareSpeciesCard
                key={s.slug}
                slug={s.slug}
                commonName={s.commonName}
                scientificName={s.scientificName}
                family={s.family}
                familyCommonName={s.familyCommonName}
                photos={s.photos}
                abundanceTier={s.abundanceTier}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() =>
                  setVisibleCount((c) =>
                    Math.min(c + LOAD_MORE_COUNT, group.species.length)
                  )
                }
                className="px-5 py-2 rounded-xl border border-border bg-card text-sm font-ui font-medium text-text-primary hover:bg-cream-dark hover:border-forest/30 transition-colors"
              >
                Show {Math.min(LOAD_MORE_COUNT, remaining)} more
                <span className="text-text-muted ml-1">
                  ({remaining} remaining)
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
          <CompareTable species={group.species as unknown as SpeciesData[]} />
        </div>
      )}
    </section>
  );
}
