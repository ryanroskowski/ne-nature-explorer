"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import GroupIcon from "@/components/ui/GroupIcon";
import type { NatureArea, AreaSpeciesData, AreaSpeciesEntry } from "@/lib/types";

interface AreaDetailPanelProps {
  area: NatureArea;
  speciesData: AreaSpeciesData | null;
  loading?: boolean;
  onClose: () => void;
}

const STATE_LABELS: Record<string, string> = {
  MA: "Massachusetts",
  CT: "Connecticut",
  ME: "Maine",
  NH: "New Hampshire",
  RI: "Rhode Island",
  VT: "Vermont",
};

const OWNER_TYPE_LABELS: Record<string, string> = {
  state: "State",
  federal: "Federal",
  nonprofit: "Nonprofit",
  municipal: "Municipal",
  other: "Other",
};

const OWNER_TYPE_COLORS: Record<string, string> = {
  state: "bg-emerald-100 text-emerald-800",
  federal: "bg-purple-100 text-purple-800",
  nonprofit: "bg-blue-100 text-blue-800",
  municipal: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-800",
};

const GROUP_ICONS: Record<string, string> = {
  plants: "🌿",
  birds: "🐦",
  fungi: "🍄",
  mammals: "🦌",
  amphibians: "🐸",
  reptiles: "🐍",
  insects: "🦋",
  lichens: "🌱",
  arachnids: "🕷️",
  mollusks: "🐚",
  fish: "🐟",
  crustaceans: "🦀",
  myriapods: "🐛",
  cnidarians: "🌊",
  echinoderms: "⭐",
};

function UniquenessLabel({ score }: { score: number }) {
  if (score > 0.95) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
        Rare find
      </span>
    );
  }
  if (score > 0.85) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
        Notable
      </span>
    );
  }
  return null;
}

function SpeciesRow({ species }: { species: AreaSpeciesEntry }) {
  return (
    <Link
      href={`/species/${species.slug}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-dark transition-colors group"
    >
      {species.thumbnailUrl ? (
        <img
          src={species.thumbnailUrl}
          alt={species.commonName}
          className="w-10 h-10 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-cream-dark shrink-0 flex items-center justify-center text-text-muted text-lg">
          <GroupIcon groupKey={species.group} emoji={GROUP_ICONS[species.group]} size={20} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-text-primary group-hover:text-forest transition-colors truncate">
            {species.commonName}
          </span>
          <UniquenessLabel score={species.uniquenessScore} />
        </div>
        <div className="text-xs text-text-muted italic truncate">
          {species.scientificName}
        </div>
      </div>
      <span className="text-xs text-text-muted shrink-0">
        {species.observationCount.toLocaleString()} obs
      </span>
    </Link>
  );
}

const GROUP_LABELS: Record<string, string> = {
  plants: "Plants",
  birds: "Birds",
  fungi: "Fungi",
  mammals: "Mammals",
  amphibians: "Amphibians",
  reptiles: "Reptiles",
  insects: "Insects",
  lichens: "Lichens",
  arachnids: "Arachnids",
  mollusks: "Mollusks",
  fish: "Fish",
};

export default function AreaDetailPanel({
  area,
  speciesData,
  loading,
  onClose,
}: AreaDetailPanelProps) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [showAllCommon, setShowAllCommon] = useState(false);

  // Reset states when area changes
  useEffect(() => {
    setActiveGroup(null);
    setShowAllHighlights(false);
    setShowAllCommon(false);
  }, [area.id]);

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${area.centroid[1]},${area.centroid[0]}`;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white border-l border-border shadow-xl z-20 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-border p-4 z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-text-primary leading-tight">
              {area.name}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  OWNER_TYPE_COLORS[area.ownerType] || OWNER_TYPE_COLORS.other
                }`}
              >
                {OWNER_TYPE_LABELS[area.ownerType]}
              </span>
              <span className="text-xs text-text-muted">
                {STATE_LABELS[area.state] || area.state}
              </span>
              <span className="text-xs text-text-muted">
                {area.acreage.toLocaleString()} acres
              </span>
              {area.publicAccess === "limited" && (
                <span className="text-xs text-amber-600">Limited access</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-cream-dark transition-colors text-text-muted"
            aria-label="Close panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-forest text-white text-xs font-ui font-medium rounded-lg hover:bg-forest-light transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Get Directions
          </a>
          <span className="text-xs text-text-muted self-center">
            {area.owner}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2 animate-pulse">🔍</div>
            <p className="text-sm text-text-muted">Loading species data...</p>
          </div>
        ) : speciesData && speciesData.speciesFound > 0 ? (
          <>
            {/* Quick stats */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/50">
              <div className="text-center">
                <div className="text-xl font-serif font-bold text-text-primary">
                  {speciesData.speciesFound}
                </div>
                <div className="text-[10px] font-ui text-text-muted">
                  species found
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(speciesData.groupBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([group, count]) => (
                    <button
                      key={group}
                      onClick={() =>
                        setActiveGroup(activeGroup === group ? null : group)
                      }
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        activeGroup === group
                          ? "bg-forest text-white"
                          : "bg-cream-dark text-text-secondary hover:bg-cream-dark/70"
                      }`}
                      title={GROUP_LABELS[group] || group}
                    >
                      <GroupIcon groupKey={group} emoji={GROUP_ICONS[group]} size={14} /> {count}
                    </button>
                  ))}
              </div>
            </div>

            {/* Species lists — filtered by active group if selected */}
            {activeGroup ? (
              <section className="mb-5">
                {(() => {
                  const groupSpecies = speciesData.groupHighlights?.[activeGroup] ||
                    [...speciesData.highlights, ...speciesData.common].filter((sp) => sp.group === activeGroup);
                  const totalInGroup = speciesData.groupBreakdown[activeGroup] || 0;
                  return (
                    <>
                      <h3 className="font-serif font-semibold text-sm text-text-primary mb-2 flex items-center gap-1.5">
                        <GroupIcon groupKey={activeGroup} emoji={GROUP_ICONS[activeGroup]} size={18} />
                        {GROUP_LABELS[activeGroup] || activeGroup}
                        <span className="text-xs font-ui font-normal text-text-muted">
                          {totalInGroup} species
                        </span>
                        <button
                          onClick={() => setActiveGroup(null)}
                          className="ml-auto text-xs text-text-muted hover:text-text-secondary font-ui font-normal"
                        >
                          Show all
                        </button>
                      </h3>
                      {groupSpecies.length > 0 ? (
                        <div className="space-y-0.5">
                          {groupSpecies.map((sp) => (
                            <SpeciesRow key={sp.slug} species={sp} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted py-3 text-center">
                          No detailed species data for this group yet.
                        </p>
                      )}
                    </>
                  );
                })()}
              </section>
            ) : (
              <>
                {/* Highlights — unique species */}
                {speciesData.highlights.length > 0 && (
                  <section className="mb-5">
                    <h3 className="font-serif font-semibold text-sm text-text-primary mb-2 flex items-center gap-1.5">
                      <span className="text-base">✨</span>
                      What&apos;s Special Here
                    </h3>
                    <div className="space-y-0.5">
                      {(showAllHighlights
                        ? speciesData.highlights
                        : speciesData.highlights.slice(0, 8)
                      ).map((sp) => (
                        <SpeciesRow key={sp.slug} species={sp} />
                      ))}
                    </div>
                    {speciesData.highlights.length > 8 && !showAllHighlights && (
                      <button
                        onClick={() => setShowAllHighlights(true)}
                        className="w-full mt-2 py-1.5 text-xs font-ui text-forest hover:text-forest-light transition-colors"
                      >
                        Show {speciesData.highlights.length - 8} more
                      </button>
                    )}
                  </section>
                )}

                {/* Common species */}
                {speciesData.common.length > 0 && (
                  <section>
                    <h3 className="font-serif font-semibold text-sm text-text-primary mb-2 flex items-center gap-1.5">
                      <span className="text-base">🌿</span>
                      Commonly Found
                    </h3>
                    <div className="space-y-0.5">
                      {(showAllCommon
                        ? speciesData.common
                        : speciesData.common.slice(0, 10)
                      ).map((sp) => (
                        <SpeciesRow key={sp.slug} species={sp} />
                      ))}
                    </div>
                    {speciesData.common.length > 10 && !showAllCommon && (
                      <button
                        onClick={() => setShowAllCommon(true)}
                        className="w-full mt-2 py-1.5 text-xs font-ui text-forest hover:text-forest-light transition-colors"
                      >
                        Show {speciesData.common.length - 10} more
                      </button>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-text-muted">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-sm">
              Species data not yet available for this area.
            </p>
            <p className="text-xs mt-1">
              Run the full pipeline to populate species data.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
