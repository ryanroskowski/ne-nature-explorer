"use client";

import { useState } from "react";
import CompareGroup from "./CompareGroup";
import type { AbundanceTier, SpeciesPhoto } from "@/lib/types";

const BATCH_SIZE = 20;

interface GenusGroup {
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
}

export default function ComparePageClient({
  groups,
}: {
  groups: GenusGroup[];
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const visibleGroups = groups.slice(0, visibleCount);
  const hasMore = visibleCount < groups.length;
  const remaining = groups.length - visibleCount;

  return (
    <>
      {visibleGroups.map((g) => (
        <CompareGroup key={g.genus} group={g} />
      ))}

      {hasMore && (
        <div className="flex justify-center py-8">
          <button
            onClick={() =>
              setVisibleCount((c) => Math.min(c + BATCH_SIZE, groups.length))
            }
            className="px-6 py-3 rounded-xl bg-forest text-white font-ui font-medium text-sm hover:bg-forest-light transition-colors shadow-sm"
          >
            Show {Math.min(BATCH_SIZE, remaining)} more groups
            <span className="text-white/70 ml-2">
              ({remaining} remaining)
            </span>
          </button>
        </div>
      )}
    </>
  );
}
