"use client";

import { useState, useMemo } from "react";
import SpeciesCard from "@/components/ui/SpeciesCard";
import type { BrowseEntry, GrowthForm, LeafType, FruitType } from "@/lib/types";

const INITIAL_VISIBLE = 24;
const LOAD_MORE_COUNT = 24;

const GROWTH_FORMS: { value: GrowthForm; label: string; icon: string }[] = [
  { value: "tree", label: "Trees", icon: "🌲" },
  { value: "shrub", label: "Shrubs", icon: "🌿" },
  { value: "herb", label: "Herbs", icon: "🌸" },
  { value: "vine", label: "Vines", icon: "🌱" },
  { value: "grass-sedge", label: "Grasses & Sedges", icon: "🌾" },
  { value: "fern", label: "Ferns", icon: "🍃" },
  { value: "moss", label: "Mosses & Clubmosses", icon: "🪨" },
  { value: "aquatic", label: "Aquatic", icon: "💧" },
];

const LEAF_TYPES: { value: LeafType; label: string }[] = [
  { value: "needles", label: "Needles" },
  { value: "broad-deciduous", label: "Broad Deciduous" },
  { value: "broad-evergreen", label: "Broad Evergreen" },
  { value: "fronds", label: "Fronds" },
  { value: "blades", label: "Blades" },
  { value: "scales", label: "Scales" },
];

const FRUIT_TYPES: { value: FruitType; label: string }[] = [
  { value: "cone", label: "Cone" },
  { value: "berry", label: "Berry" },
  { value: "nut-acorn", label: "Nut/Acorn" },
  { value: "drupe", label: "Drupe" },
  { value: "pod", label: "Pod" },
  { value: "capsule", label: "Capsule" },
  { value: "winged-seed", label: "Winged Seed" },
  { value: "achene", label: "Achene" },
  { value: "aggregate", label: "Aggregate" },
  { value: "spore", label: "Spore" },
];

const HABITATS = ["forest", "wetland", "meadow", "roadside", "alpine", "coastal", "garden"];

interface ActiveFilters {
  growthForms: GrowthForm[];
  leafTypes: LeafType[];
  fruitTypes: FruitType[];
  habitats: string[];
  nativeOnly: boolean;
}

export default function TraitBrowser({ entries }: { entries: BrowseEntry[] }) {
  const [filters, setFilters] = useState<ActiveFilters>({
    growthForms: [],
    leafTypes: [],
    fruitTypes: [],
    habitats: [],
    nativeOnly: false,
  });
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [refineOpen, setRefineOpen] = useState(false);

  // Count species per growth form for the grid cards
  const growthFormCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      const gf = e.traits.growthForm;
      if (gf) counts[gf] = (counts[gf] || 0) + 1;
    }
    return counts;
  }, [entries]);

  // Find representative thumbnail for each growth form (first species = most observed)
  const growthFormThumbnails = useMemo(() => {
    const thumbs: Record<string, string | undefined> = {};
    for (const gf of GROWTH_FORMS) {
      const rep = entries.find((e) => e.traits.growthForm === gf.value && e.thumbnailUrl);
      thumbs[gf.value] = rep?.thumbnailUrl;
    }
    return thumbs;
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.growthForms.length > 0 && (!e.traits.growthForm || !filters.growthForms.includes(e.traits.growthForm))) return false;
      if (filters.leafTypes.length > 0 && (!e.traits.leafType || !filters.leafTypes.includes(e.traits.leafType))) return false;
      if (filters.fruitTypes.length > 0 && (!e.traits.fruitType || !filters.fruitTypes.includes(e.traits.fruitType))) return false;
      if (filters.habitats.length > 0 && !filters.habitats.some((h) => (e.traits.habitatTypes || []).includes(h))) return false;
      if (filters.nativeOnly && !e.traits.isNative) return false;
      return true;
    });
  }, [entries, filters]);

  const hasAnyFilter =
    filters.growthForms.length > 0 ||
    filters.leafTypes.length > 0 ||
    filters.fruitTypes.length > 0 ||
    filters.habitats.length > 0 ||
    filters.nativeOnly;

  const visibleSpecies = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function toggleGrowthForm(gf: GrowthForm) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      growthForms: f.growthForms.includes(gf)
        ? f.growthForms.filter((g) => g !== gf)
        : [...f.growthForms, gf],
    }));
  }

  function toggleLeafType(lt: LeafType) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      leafTypes: f.leafTypes.includes(lt)
        ? f.leafTypes.filter((l) => l !== lt)
        : [...f.leafTypes, lt],
    }));
  }

  function toggleFruitType(ft: FruitType) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      fruitTypes: f.fruitTypes.includes(ft)
        ? f.fruitTypes.filter((t) => t !== ft)
        : [...f.fruitTypes, ft],
    }));
  }

  function toggleHabitat(h: string) {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters((f) => ({
      ...f,
      habitats: f.habitats.includes(h)
        ? f.habitats.filter((x) => x !== h)
        : [...f.habitats, h],
    }));
  }

  function clearAll() {
    setVisibleCount(INITIAL_VISIBLE);
    setFilters({ growthForms: [], leafTypes: [], fruitTypes: [], habitats: [], nativeOnly: false });
  }

  return (
    <div>
      {/* Growth Form Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {GROWTH_FORMS.map((gf) => {
          const isSelected = filters.growthForms.includes(gf.value);
          const count = growthFormCounts[gf.value] || 0;
          return (
            <button
              key={gf.value}
              onClick={() => toggleGrowthForm(gf.value)}
              className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                isSelected
                  ? "border-forest bg-forest/10 shadow-sm"
                  : "border-border bg-card hover:border-forest/30 hover:-translate-y-0.5"
              }`}
              aria-pressed={isSelected}
            >
              {growthFormThumbnails[gf.value] && (
                <div className="absolute inset-0 opacity-15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={growthFormThumbnails[gf.value]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <span className="relative text-2xl">{gf.icon}</span>
              <span className="relative font-ui font-semibold text-sm text-text-primary">
                {gf.label}
              </span>
              <span className="relative text-xs font-ui text-text-muted">
                {count} species
              </span>
            </button>
          );
        })}
      </div>

      {/* Refine panel toggle */}
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

      {/* Refine panel */}
      {refineOpen && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-5">
          {/* Leaf Type */}
          <div>
            <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Leaf Type</h3>
            <div className="flex flex-wrap gap-2">
              {LEAF_TYPES.map((lt) => {
                const isActive = filters.leafTypes.includes(lt.value);
                return (
                  <button
                    key={lt.value}
                    onClick={() => toggleLeafType(lt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                      isActive
                        ? "bg-forest text-white"
                        : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                    }`}
                    aria-pressed={isActive}
                  >
                    {lt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fruit/Seed Type */}
          <div>
            <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Fruit / Seed Type</h3>
            <div className="flex flex-wrap gap-2">
              {FRUIT_TYPES.map((ft) => {
                const isActive = filters.fruitTypes.includes(ft.value);
                return (
                  <button
                    key={ft.value}
                    onClick={() => toggleFruitType(ft.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
                      isActive
                        ? "bg-forest text-white"
                        : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                    }`}
                    aria-pressed={isActive}
                  >
                    {ft.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Habitat */}
          <div>
            <h3 className="text-sm font-ui font-semibold text-text-primary mb-2">Habitat</h3>
            <div className="flex flex-wrap gap-2">
              {HABITATS.map((h) => {
                const isActive = filters.habitats.includes(h);
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
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Native toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setVisibleCount(INITIAL_VISIBLE);
                setFilters((f) => ({ ...f, nativeOnly: !f.nativeOnly }));
              }}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                filters.nativeOnly ? "bg-forest" : "bg-cream-dark"
              }`}
              role="switch"
              aria-checked={filters.nativeOnly}
              aria-label="Show native species only"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  filters.nativeOnly ? "translate-x-4" : ""
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
          {filters.growthForms.map((gf) => (
            <span key={gf} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {GROWTH_FORMS.find((g) => g.value === gf)?.label}
              <button onClick={() => toggleGrowthForm(gf)} className="hover:text-forest-dark" aria-label={`Remove ${gf} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.leafTypes.map((lt) => (
            <span key={lt} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {LEAF_TYPES.find((l) => l.value === lt)?.label}
              <button onClick={() => toggleLeafType(lt)} className="hover:text-forest-dark" aria-label={`Remove ${lt} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.fruitTypes.map((ft) => (
            <span key={ft} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              {FRUIT_TYPES.find((t) => t.value === ft)?.label}
              <button onClick={() => toggleFruitType(ft)} className="hover:text-forest-dark" aria-label={`Remove ${ft} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.habitats.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui capitalize">
              {h}
              <button onClick={() => toggleHabitat(h)} className="hover:text-forest-dark" aria-label={`Remove ${h} filter`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          {filters.nativeOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/10 text-forest text-sm font-ui">
              Native only
              <button onClick={() => setFilters((f) => ({ ...f, nativeOnly: false }))} className="hover:text-forest-dark" aria-label="Remove native filter">
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
