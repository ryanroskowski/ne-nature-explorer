"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import SpeciesLink from "@/components/species-panel/SpeciesLink";
import GroupIcon from "@/components/ui/GroupIcon";
import MonthSelector, { MONTHS, MONTH_SEASON } from "./MonthSelector";
import { blurDataURL } from "@/lib/image-utils";
import type { MonthlyGuide as MonthlyGuideType, GroupInfo } from "@/lib/types";

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

// Map month string keys to numeric keys used in data
const MONTH_KEY_TO_NUM: Record<string, string> = {
  january: "1", february: "2", march: "3", april: "4",
  may: "5", june: "6", july: "7", august: "8",
  september: "9", october: "10", november: "11", december: "12",
};

interface Props {
  guide: MonthlyGuideType;
  groups: GroupInfo[];
}

export default function MonthlyGuide({ guide, groups }: Props) {
  const currentMonthIndex = new Date().getMonth();
  const currentMonthKey = MONTHS[currentMonthIndex].key;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, number>>({});

  const allMonths = MONTHS.map((m) => m.key);
  const monthNum = MONTH_KEY_TO_NUM[selectedMonth];
  const season = MONTH_SEASON[selectedMonth];
  const monthLabel = MONTHS.find((m) => m.key === selectedMonth)?.label;

  // Build a map of group key → group info for icon/label lookup
  const groupMap = useMemo(() => {
    const map = new Map<string, GroupInfo>();
    for (const g of groups) map.set(g.key, g);
    return map;
  }, [groups]);

  // Sort groups by total observations this month (most active first)
  const sortedGroups = useMemo(() => {
    return Object.entries(guide.groups)
      .map(([key, data]) => ({
        key,
        info: groupMap.get(key),
        monthData: data.months[monthNum],
      }))
      .filter((g) => g.monthData && g.monthData.species.length > 0)
      .sort((a, b) => b.monthData.totalObservations - a.monthData.totalObservations);
  }, [guide, monthNum, groupMap]);

  // Count total species and observations across all groups
  const totalSpecies = sortedGroups.reduce((sum, g) => sum + g.monthData.species.length, 0);
  const totalObs = sortedGroups.reduce((sum, g) => sum + g.monthData.totalObservations, 0);
  const newArrivals = sortedGroups.reduce(
    (sum, g) => sum + g.monthData.species.filter((s) => s.isNewArrival).length,
    0
  );

  function getVisibleCount(groupKey: string) {
    return expandedGroups[groupKey] || INITIAL_SPECIES;
  }

  function showMore(groupKey: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] || INITIAL_SPECIES) + LOAD_MORE_COUNT,
    }));
  }

  return (
    <div>
      {/* Season banner */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{SEASON_ICONS[season]}</span>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-bold text-text-primary">
              {monthLabel} — {SEASON_LABELS[season]}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {totalSpecies} species across {sortedGroups.length} groups
              {" · "}
              {totalObs.toLocaleString()} observations
              {newArrivals > 0 && (
                <span className="text-forest font-medium"> · {newArrivals} new this month</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Month selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        availableMonths={allMonths}
        onSelect={(m) => {
          setSelectedMonth(m);
          setExpandedGroups({});
        }}
      />

      {/* Group sections */}
      {sortedGroups.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No observation data for this month yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedGroups.map(({ key, info, monthData }) => {
            const visibleCount = getVisibleCount(key);
            const visibleSpecies = monthData.species.slice(0, visibleCount);
            const hasMore = visibleCount < monthData.species.length;

            return (
              <section key={key}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-4">
                  <GroupIcon groupKey={key} emoji={info?.icon} size={26} />
                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-bold text-text-primary">
                      {info?.label || key}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {monthData.species.length} species · {monthData.totalObservations.toLocaleString()} observations
                    </p>
                  </div>
                </div>

                {/* Species grid */}
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
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors truncate">
                            {sp.commonName}
                          </h4>
                          {sp.isNewArrival && (
                            <span className="shrink-0 text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              New
                            </span>
                          )}
                          {sp.isDepartingSoon && (
                            <span className="shrink-0 text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Last chance
                            </span>
                          )}
                        </div>
                        <p className="italic text-xs text-text-secondary truncate">
                          {sp.scientificName}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {sp.observationCount.toLocaleString()} obs
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
                      onClick={() => showMore(key)}
                      className="text-sm font-ui text-forest hover:text-forest-light transition-colors"
                    >
                      Show more ({monthData.species.length - visibleCount} remaining)
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
