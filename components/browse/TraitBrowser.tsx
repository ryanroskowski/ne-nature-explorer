"use client";

import { useState, useMemo, useCallback } from "react";
import SpeciesCard from "@/components/ui/SpeciesCard";
import type { BrowseEntry } from "@/lib/types";
import type { GroupBrowseConfig } from "@/lib/trait-configs";

const INITIAL_VISIBLE = 24;
const LOAD_MORE_COUNT = 24;

const HABITATS = ["forest", "wetland", "meadow", "roadside", "alpine", "coastal", "garden", "freshwater", "urban"];

function getTraitValue(entry: BrowseEntry, key: string): string | string[] | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entry.traits as any)[key];
}

interface Props {
  entries: BrowseEntry[];
  config: GroupBrowseConfig;
}

export default function TraitBrowser({ entries, config }: Props) {
  // Generic filter state: filterKey -> selected values
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [nativeOnly, setNativeOnly] = useState(false);
  const [selectedHabitats, setSelectedHabitats] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [refineOpen, setRefineOpen] = useState(true);

  // Determine which filters to show as grid vs pills
  // Primary filter goes in the grid if it has >=2 options with species
  const allFilters = useMemo(
    () => [config.primaryFilter, ...config.secondaryFilters],
    [config.primaryFilter, config.secondaryFilters]
  );

  const filterCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    for (const filter of allFilters) {
      counts[filter.key] = {};
      for (const opt of filter.options) {
        counts[filter.key][opt.value] = 0;
      }
      for (const e of entries) {
        const val = getTraitValue(e, filter.key);
        if (typeof val === "string" && counts[filter.key][val] !== undefined) {
          counts[filter.key][val]++;
        }
      }
    }
    return counts;
  }, [entries, allFilters]);

  // Check if primary filter is useful (>=2 options with >0 species)
  const primaryUsefulOptions = useMemo(() => {
    const pc = filterCounts[config.primaryFilter.key] || {};
    return config.primaryFilter.options.filter((o) => (pc[o.value] || 0) > 0);
  }, [filterCounts, config.primaryFilter]);

  const primaryIsUseful = primaryUsefulOptions.length >= 2;

  // If primary isn't useful, find the best secondary filter to promote to grid
  const promotedFilter = useMemo(() => {
    if (primaryIsUseful) return null;
    // Pick secondary filter with most options that have data, preferring good distribution
    let best = null;
    let bestScore = 0;
    for (const f of config.secondaryFilters) {
      const fc = filterCounts[f.key] || {};
      const usefulOpts = f.options.filter((o) => (fc[o.value] || 0) > 0);
      if (usefulOpts.length > bestScore) {
        bestScore = usefulOpts.length;
        best = f;
      }
    }
    return best;
  }, [primaryIsUseful, config.secondaryFilters, filterCounts]);

  const gridFilter = primaryIsUseful ? config.primaryFilter : promotedFilter;
  const pillFilters = useMemo(() => {
    return allFilters.filter((f) => {
      if (f === gridFilter) return false;
      // Skip filters where no option has data
      const fc = filterCounts[f.key] || {};
      return f.options.some((o) => (fc[o.value] || 0) > 0);
    });
  }, [allFilters, gridFilter, filterCounts]);

  // Find representative thumbnails for grid filter options
  const gridThumbnails = useMemo(() => {
    if (!gridFilter) return {};
    const thumbs: Record<string, string | undefined> = {};
    for (const opt of gridFilter.options) {
      const rep = entries.find(
        (e) => getTraitValue(e, gridFilter.key) === opt.value && e.thumbnailUrl
      );
      thumbs[opt.value] = rep?.thumbnailUrl;
    }
    return thumbs;
  }, [entries, gridFilter]);

  // Filtered results
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Check all active filters
      for (const [key, values] of Object.entries(selectedFilters)) {
        if (values.length === 0) continue;
        const traitVal = getTraitValue(e, key);
        if (typeof traitVal === "string") {
          if (!values.includes(traitVal)) return false;
        } else {
          return false;
        }
      }
      // Habitat filter
      if (selectedHabitats.length > 0) {
        if (!selectedHabitats.some((h) => (e.traits.habitatTypes || []).includes(h))) return false;
      }
      // Native filter
      if (nativeOnly && !e.traits.isNative) return false;
      return true;
    });
  }, [entries, selectedFilters, selectedHabitats, nativeOnly]);

  const hasAnyFilter =
    Object.values(selectedFilters).some((v) => v.length > 0) ||
    selectedHabitats.length > 0 ||
    nativeOnly;

  const visibleSpecies = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const toggleFilter = useCallback((key: string, value: string) => {
    setVisibleCount(INITIAL_VISIBLE);
    setSelectedFilters((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }, []);

  const toggleHabitat = useCallback((h: string) => {
    setVisibleCount(INITIAL_VISIBLE);
    setSelectedHabitats((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );
  }, []);

  function clearAll() {
    setVisibleCount(INITIAL_VISIBLE);
    setSelectedFilters({});
    setSelectedHabitats([]);
    setNativeOnly(false);
  }

  // Find label for a filter value
  function findLabel(key: string, value: string): string {
    for (const f of allFilters) {
      if (f.key === key) {
        const opt = f.options.find((o) => o.value === value);
        if (opt) return opt.label;
      }
    }
    return value;
  }

  // Check if habitats have any data
  const habitatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of HABITATS) {
      counts[h] = entries.filter((e) => (e.traits.habitatTypes || []).includes(h)).length;
    }
    return counts;
  }, [entries]);
  const hasHabitatData = HABITATS.some((h) => habitatCounts[h] > 0);

  return (
    <div>
      {/* Grid filter (primary or promoted) */}
      {gridFilter && (
        <>
          <h3 className="text-sm font-ui font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            {gridFilter.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {gridFilter.options
              .filter((opt) => (filterCounts[gridFilter.key]?.[opt.value] || 0) > 0)
              .map((opt) => {
                const isSelected = (selectedFilters[gridFilter.key] || []).includes(opt.value);
                const count = filterCounts[gridFilter.key]?.[opt.value] || 0;
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleFilter(gridFilter.key, opt.value)}
                    className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? "border-forest bg-forest/10 shadow-sm"
                        : "border-border bg-card hover:border-forest/30 hover:-translate-y-0.5"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {gridThumbnails[opt.value] && (
                      <div className="absolute inset-0 opacity-15">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gridThumbnails[opt.value]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {opt.icon && <span className="relative text-2xl">{opt.icon}</span>}
                    <span className="relative font-ui font-semibold text-sm text-text-primary">
                      {opt.label}
                    </span>
                    <span className="relative text-xs font-ui text-text-muted">
                      {count} species
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* Refine panel toggle */}
      {pillFilters.length > 0 && (
        <button
          onClick={() => setRefineOpen(!refineOpen)}
          className="flex items-center gap-2 text-sm font-ui font-medium text-forest hover:text-forest-light transition-colors mb-4"
          aria-expanded={refineOpen}
        >
          <svg className={`w-4 h-4 transition-transform ${refineOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Refine filters
        </button>
      )}

      {/* Refine panel */}
      {refineOpen && pillFilters.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-5">
          {/* Dynamic secondary filters */}
          {pillFilters.map((filter) => (
            <div key={filter.key}>
              <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">{filter.label}</h3>
              <div className="flex flex-wrap gap-2">
                {filter.options
                  .filter((opt) => (filterCounts[filter.key]?.[opt.value] || 0) > 0)
                  .map((opt) => {
                    const isActive = (selectedFilters[filter.key] || []).includes(opt.value);
                    const count = filterCounts[filter.key]?.[opt.value] || 0;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleFilter(filter.key, opt.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                          isActive
                            ? "bg-forest text-white"
                            : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                        }`}
                        aria-pressed={isActive}
                      >
                        {opt.label} ({count})
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Habitat */}
          {hasHabitatData && (
            <div>
              <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Habitat</h3>
              <div className="flex flex-wrap gap-2">
                {HABITATS.filter((h) => habitatCounts[h] > 0).map((h) => {
                  const isActive = selectedHabitats.includes(h);
                  return (
                    <button
                      key={h}
                      onClick={() => toggleHabitat(h)}
                      className={`px-3 py-1.5 rounded-full text-sm font-ui capitalize transition-colors ${
                        isActive
                          ? "bg-forest text-white"
                          : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                      }`}
                      aria-pressed={isActive}
                    >
                      {h} ({habitatCounts[h]})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Native toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setVisibleCount(INITIAL_VISIBLE);
                setNativeOnly((prev) => !prev);
              }}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                nativeOnly ? "bg-forest" : "bg-cream-dark"
              }`}
              role="switch"
              aria-checked={nativeOnly}
              aria-label="Show native species only"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  nativeOnly ? "translate-x-4" : ""
                }`}
              />
            </button>
            <span className="text-sm font-ui text-text-secondary">Native species only</span>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {Object.entries(selectedFilters).flatMap(([key, values]) =>
            values.map((val) => (
              <span key={`${key}-${val}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
                {findLabel(key, val)}
                <button onClick={() => toggleFilter(key, val)} className="hover:text-forest-dark" aria-label={`Remove ${val} filter`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))
          )}
          {selectedHabitats.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui capitalize">
              {h}
              <button onClick={() => toggleHabitat(h)} className="hover:text-forest-dark" aria-label={`Remove ${h} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {nativeOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              Native only
              <button onClick={() => setNativeOnly(false)} className="hover:text-forest-dark" aria-label="Remove native filter">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
          <button
            onClick={clearAll}
            className="text-sm font-ui text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm font-ui text-text-muted mb-4">
        {filtered.length === entries.length
          ? `${entries.length} species`
          : `${filtered.length} of ${entries.length} species`}
      </p>

      {/* Results grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg">No species match these filters.</p>
          <button
            onClick={clearAll}
            className="mt-3 text-sm font-ui text-forest hover:text-forest-light transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleSpecies.map((e) => (
              <SpeciesCard
                key={e.slug}
                slug={e.slug}
                commonName={e.commonName}
                scientificName={e.scientificName}
                family={e.family}
                familyCommonName={e.familyCommonName}
                thumbnailUrl={e.thumbnailUrl}
                photos={e.photos}
                abundanceTier={e.abundanceTier}
              />
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
                className="px-6 py-2.5 bg-card border border-border rounded-xl text-sm font-ui font-medium text-text-primary hover:bg-cream-dark transition-colors"
              >
                Show more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
