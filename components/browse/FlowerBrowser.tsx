"use client";

import { useState, useMemo } from "react";
import SpeciesCard from "@/components/ui/SpeciesCard";
import FlowerColorPicker from "./FlowerColorPicker";
import type { BrowseEntry, FlowerShape, BloomPeriod, GrowthForm } from "@/lib/types";

const INITIAL_VISIBLE = 24;
const LOAD_MORE_COUNT = 24;

const FLOWER_SHAPES: { value: FlowerShape; label: string }[] = [
  { value: "composite", label: "Composite" },
  { value: "tubular", label: "Tubular" },
  { value: "bell", label: "Bell" },
  { value: "pea-like", label: "Pea-like" },
  { value: "radial", label: "Radial" },
  { value: "irregular", label: "Irregular" },
  { value: "catkin", label: "Catkin" },
  { value: "umbel", label: "Umbel" },
  { value: "spike", label: "Spike" },
];

const BLOOM_PERIODS: { value: BloomPeriod; label: string }[] = [
  { value: "early-spring", label: "Early Spring" },
  { value: "spring", label: "Spring" },
  { value: "late-spring", label: "Late Spring" },
  { value: "early-summer", label: "Early Summer" },
  { value: "summer", label: "Summer" },
  { value: "late-summer", label: "Late Summer" },
  { value: "fall", label: "Fall" },
];

const GROWTH_FORMS: { value: GrowthForm; label: string }[] = [
  { value: "tree", label: "Tree" },
  { value: "shrub", label: "Shrub" },
  { value: "herb", label: "Herb" },
  { value: "vine", label: "Vine" },
  { value: "grass-sedge", label: "Grass/Sedge" },
  { value: "aquatic", label: "Aquatic" },
];

interface FlowerFilters {
  colors: string[];
  shapes: FlowerShape[];
  bloomPeriods: BloomPeriod[];
  growthForms: GrowthForm[];
}

export default function FlowerBrowser({ entries }: { entries: BrowseEntry[] }) {
  const [filters, setFilters] = useState<FlowerFilters>({
    colors: [],
    shapes: [],
    bloomPeriods: [],
    growthForms: [],
  });
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Count species per color
  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      for (const c of (e.traits.flowerColors || [])) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.colors.length > 0 && !filters.colors.some((c) => (e.traits.flowerColors || []).includes(c))) return false;
      if (filters.shapes.length > 0 && (!e.traits.flowerShape || !filters.shapes.includes(e.traits.flowerShape))) return false;
      if (filters.bloomPeriods.length > 0 && (!e.traits.bloomPeriod || !filters.bloomPeriods.includes(e.traits.bloomPeriod))) return false;
      if (filters.growthForms.length > 0 && (!e.traits.growthForm || !filters.growthForms.includes(e.traits.growthForm))) return false;
      return true;
    });
  }, [entries, filters]);

  const hasAnyFilter =
    filters.colors.length > 0 ||
    filters.shapes.length > 0 ||
    filters.bloomPeriods.length > 0 ||
    filters.growthForms.length > 0;

  const visibleSpecies = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function toggleColor(color: string) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      colors: f.colors.includes(color)
        ? f.colors.filter((c) => c !== color)
        : [...f.colors, color],
    }));
  }

  function toggleShape(shape: FlowerShape) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      shapes: f.shapes.includes(shape)
        ? f.shapes.filter((s) => s !== shape)
        : [...f.shapes, shape],
    }));
  }

  function toggleBloom(bp: BloomPeriod) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      bloomPeriods: f.bloomPeriods.includes(bp)
        ? f.bloomPeriods.filter((b) => b !== bp)
        : [...f.bloomPeriods, bp],
    }));
  }

  function toggleGrowthForm(gf: GrowthForm) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      growthForms: f.growthForms.includes(gf)
        ? f.growthForms.filter((g) => g !== gf)
        : [...f.growthForms, gf],
    }));
  }

  function clearAll() {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters({ colors: [], shapes: [], bloomPeriods: [], growthForms: [] });
  }

  return (
    <div>
      {/* Color Picker */}
      <FlowerColorPicker
        selectedColors={filters.colors}
        colorCounts={colorCounts}
        onToggle={toggleColor}
      />

      {/* Secondary filters */}
      <div className="space-y-4 mb-6">
        {/* Flower Shape */}
        <div>
          <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Flower Shape</h3>
          <div className="flex flex-wrap gap-2">
            {FLOWER_SHAPES.map((s) => {
              const isActive = filters.shapes.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => toggleShape(s.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                    isActive
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                  aria-pressed={isActive}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bloom Period */}
        <div>
          <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Bloom Period</h3>
          <div className="flex flex-wrap gap-2">
            {BLOOM_PERIODS.map((bp) => {
              const isActive = filters.bloomPeriods.includes(bp.value);
              return (
                <button
                  key={bp.value}
                  onClick={() => toggleBloom(bp.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                    isActive
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                  aria-pressed={isActive}
                >
                  {bp.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Growth Form */}
        <div>
          <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Growth Form</h3>
          <div className="flex flex-wrap gap-2">
            {GROWTH_FORMS.map((gf) => {
              const isActive = filters.growthForms.includes(gf.value);
              return (
                <button
                  key={gf.value}
                  onClick={() => toggleGrowthForm(gf.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                    isActive
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                  aria-pressed={isActive}
                >
                  {gf.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {filters.colors.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui capitalize">
              <span className="w-3 h-3 rounded-full border border-current/20" style={{ backgroundColor: COLOR_MAP[c] || c }} />
              {c}
              <button onClick={() => toggleColor(c)} className="hover:text-forest-dark" aria-label={`Remove ${c} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.shapes.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {FLOWER_SHAPES.find((fs) => fs.value === s)?.label}
              <button onClick={() => toggleShape(s)} className="hover:text-forest-dark" aria-label={`Remove ${s} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.bloomPeriods.map((bp) => (
            <span key={bp} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {BLOOM_PERIODS.find((b) => b.value === bp)?.label}
              <button onClick={() => toggleBloom(bp)} className="hover:text-forest-dark" aria-label={`Remove ${bp} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.growthForms.map((gf) => (
            <span key={gf} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {GROWTH_FORMS.find((g) => g.value === gf)?.label}
              <button onClick={() => toggleGrowthForm(gf)} className="hover:text-forest-dark" aria-label={`Remove ${gf} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
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
          ? `${entries.length} flowering species`
          : `${filtered.length} of ${entries.length} flowering species`}
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

// Color name to CSS color mapping (used in filter chips)
const COLOR_MAP: Record<string, string> = {
  white: "#FFFFFF",
  yellow: "#FFD700",
  orange: "#FF8C00",
  pink: "#FF69B4",
  red: "#DC143C",
  purple: "#8B008B",
  blue: "#4169E1",
  green: "#228B22",
};
