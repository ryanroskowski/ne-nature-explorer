"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Fuse from "fuse.js";
import SpeciesCard from "@/components/ui/SpeciesCard";
import GroupIcon from "@/components/ui/GroupIcon";
import type { SearchEntry, GroupInfo, AbundanceTier } from "@/lib/types";

// ============================================================
// Types for supplementary indexes (articles + nature areas)
// ============================================================

interface ArticleSearchEntry {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  preview: string;
  relatedSpeciesSlugs: string[];
}

interface AreaSearchEntry {
  id: string;
  name: string;
  state: string;
  owner: string;
  ownerType: string;
  purpose: string;
  acreage: number;
  centroid: [number, number];
}

// ============================================================
// Constants
// ============================================================

const ABUNDANCE_TIERS: { tier: AbundanceTier; label: string; icon: string }[] = [
  { tier: "very-common", label: "Very common", icon: "🌟" },
  { tier: "common", label: "Common", icon: "✨" },
  { tier: "moderate", label: "Moderate", icon: "🔹" },
  { tier: "uncommon", label: "Uncommon", icon: "🔸" },
  { tier: "rare", label: "Rare", icon: "💎" },
];

type SortMode = "relevance" | "alphabetical";

const RECENT_SEARCHES_KEY = "ne-nature:recent-searches";
const MAX_RECENT = 6;

// ============================================================
// Persistent recent searches (localStorage)
// ============================================================

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string): void {
  if (!query || query.length < 2) return;
  try {
    const existing = loadRecent().filter(
      (q) => q.toLowerCase() !== query.toLowerCase()
    );
    const next = [query, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {}
}

// ============================================================
// Index loaders — cached at module level so navigating away and back
// doesn't re-fetch.
// ============================================================

let speciesIndexCache: SearchEntry[] | null = null;
let articlesIndexCache: ArticleSearchEntry[] | null = null;
let areasIndexCache: AreaSearchEntry[] | null = null;

async function loadSpeciesIndex(): Promise<SearchEntry[]> {
  if (speciesIndexCache) return speciesIndexCache;
  const res = await fetch("/api/search-index");
  speciesIndexCache = await res.json();
  return speciesIndexCache!;
}

async function loadArticlesIndex(): Promise<ArticleSearchEntry[]> {
  if (articlesIndexCache) return articlesIndexCache;
  try {
    const res = await fetch("/api/search-articles");
    if (!res.ok) {
      articlesIndexCache = [];
      return articlesIndexCache;
    }
    articlesIndexCache = await res.json();
    return articlesIndexCache!;
  } catch {
    articlesIndexCache = [];
    return articlesIndexCache;
  }
}

async function loadAreasIndex(): Promise<AreaSearchEntry[]> {
  if (areasIndexCache) return areasIndexCache;
  try {
    const res = await fetch("/api/search-areas");
    if (!res.ok) {
      areasIndexCache = [];
      return areasIndexCache;
    }
    areasIndexCache = await res.json();
    return areasIndexCache!;
  } catch {
    areasIndexCache = [];
    return areasIndexCache;
  }
}

// ============================================================
// Main component
// ============================================================

interface SearchPageClientProps {
  initialQuery: string;
  groups: GroupInfo[];
}

export default function SearchPageClient({
  initialQuery,
  groups,
}: SearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    () => new Set(searchParams.get("groups")?.split(",").filter(Boolean) || [])
  );
  const [selectedTiers, setSelectedTiers] = useState<Set<AbundanceTier>>(
    () =>
      new Set(
        (searchParams.get("tiers")?.split(",").filter(Boolean) ||
          []) as AbundanceTier[]
      )
  );
  const [nativeFilter, setNativeFilter] = useState<
    "all" | "native" | "introduced" | "invasive"
  >(
    (searchParams.get("status") as "all" | "native" | "introduced" | "invasive") ||
      "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>(
    (searchParams.get("sort") as SortMode) || "relevance"
  );
  const [showFilters, setShowFilters] = useState(true);

  // Loaded indexes + Fuse instances
  const [speciesIndex, setSpeciesIndex] = useState<SearchEntry[] | null>(null);
  const [articlesIndex, setArticlesIndex] = useState<
    ArticleSearchEntry[] | null
  >(null);
  const [areasIndex, setAreasIndex] = useState<AreaSearchEntry[] | null>(null);

  // Lazy init so we read localStorage once during SSR-safe mount, avoiding
  // a setState-in-effect warning. The initializer only runs client-side
  // because this file is a "use client" component.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return loadRecent();
  });
  const [showMoreSpecies, setShowMoreSpecies] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ----- Load indexes on mount -----
  useEffect(() => {
    loadSpeciesIndex().then(setSpeciesIndex);
    loadArticlesIndex().then(setArticlesIndex);
    loadAreasIndex().then(setAreasIndex);
  }, []);

  // ----- Auto-focus the search input on mount if no query yet -----
  useEffect(() => {
    if (!initialQuery) {
      inputRef.current?.focus();
    }
  }, [initialQuery]);

  // ----- Debounce query to avoid running Fuse on every keystroke -----
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // ----- Persist query + filters to URL (shareable) -----
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (selectedGroups.size > 0) {
      params.set("groups", Array.from(selectedGroups).join(","));
    }
    if (selectedTiers.size > 0) {
      params.set("tiers", Array.from(selectedTiers).join(","));
    }
    if (nativeFilter !== "all") params.set("status", nativeFilter);
    if (sortMode !== "relevance") params.set("sort", sortMode);

    // Preserve the species panel param if it's set
    const species = searchParams.get("species");
    if (species) params.set("species", species);

    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ""}`;
    const currentUrl = `/search${window.location.search}`;
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [
    debouncedQuery,
    selectedGroups,
    selectedTiers,
    nativeFilter,
    sortMode,
    router,
    searchParams,
  ]);

  // ----- Save to recent searches when debounced query settles -----
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      saveRecent(debouncedQuery.trim());
      // Syncing with an external store (localStorage) — this is a legitimate
      // use of setState in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentSearches(loadRecent());
    }
  }, [debouncedQuery]);

  // ----- Build Fuse instances (memoized) -----
  const speciesFuse = useMemo(() => {
    if (!speciesIndex) return null;
    return new Fuse(speciesIndex, {
      keys: [
        { name: "commonName", weight: 0.5 },
        { name: "alternativeNames", weight: 0.35 },
        { name: "scientificName", weight: 0.3 },
        { name: "familyCommonName", weight: 0.1 },
        { name: "genus", weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [speciesIndex]);

  const articlesFuse = useMemo(() => {
    if (!articlesIndex) return null;
    return new Fuse(articlesIndex, {
      keys: [
        { name: "title", weight: 0.6 },
        { name: "subtitle", weight: 0.3 },
        { name: "preview", weight: 0.1 },
      ],
      // Tighter than species search — otherwise short queries pull in every
      // article that happens to contain a vaguely similar substring.
      threshold: 0.2,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [articlesIndex]);

  const areasFuse = useMemo(() => {
    if (!areasIndex) return null;
    return new Fuse(areasIndex, {
      keys: [
        { name: "name", weight: 0.6 },
        { name: "owner", weight: 0.3 },
        { name: "state", weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [areasIndex]);

  // ----- Run species search + apply filters -----
  const speciesResults = useMemo(() => {
    if (!speciesFuse || debouncedQuery.trim().length < 2) return [];

    const raw = speciesFuse
      .search(debouncedQuery.trim(), { limit: 500 })
      .map((r) => r.item)
      .filter((e) => e.type === "species");

    const filtered = raw.filter((e) => {
      if (selectedGroups.size > 0 && !selectedGroups.has(e.group || "")) {
        return false;
      }
      if (
        selectedTiers.size > 0 &&
        e.abundanceTier &&
        !selectedTiers.has(e.abundanceTier)
      ) {
        return false;
      }
      if (nativeFilter === "native" && e.isNative !== true) return false;
      if (nativeFilter === "introduced" && e.isNative !== false) return false;
      if (nativeFilter === "invasive" && !e.isInvasive) return false;
      return true;
    });

    if (sortMode === "alphabetical") {
      filtered.sort((a, b) => a.commonName.localeCompare(b.commonName));
    }

    return filtered;
  }, [
    speciesFuse,
    debouncedQuery,
    selectedGroups,
    selectedTiers,
    nativeFilter,
    sortMode,
  ]);

  // ----- Run genera & families (no filters applied, just search) -----
  const taxaResults = useMemo(() => {
    if (!speciesFuse || debouncedQuery.trim().length < 2) return [];
    return speciesFuse
      .search(debouncedQuery.trim(), { limit: 20 })
      .map((r) => r.item)
      .filter((e) => e.type === "genus" || e.type === "family")
      .slice(0, 8);
  }, [speciesFuse, debouncedQuery]);

  const articleResults = useMemo(() => {
    if (!articlesFuse || debouncedQuery.trim().length < 2) return [];
    return articlesFuse
      .search(debouncedQuery.trim(), { limit: 12 })
      .map((r) => r.item);
  }, [articlesFuse, debouncedQuery]);

  const areaResults = useMemo(() => {
    if (!areasFuse || debouncedQuery.trim().length < 2) return [];
    return areasFuse.search(debouncedQuery.trim(), { limit: 12 }).map((r) => r.item);
  }, [areasFuse, debouncedQuery]);

  // ----- Filter toggles -----
  const toggleGroup = useCallback((key: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleTier = useCallback((tier: AbundanceTier) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedGroups(new Set());
    setSelectedTiers(new Set());
    setNativeFilter("all");
  }, []);

  const filterCount =
    selectedGroups.size +
    selectedTiers.size +
    (nativeFilter !== "all" ? 1 : 0);

  const hasQuery = debouncedQuery.trim().length >= 2;
  const isLoadingIndexes = !speciesIndex;
  const noResults =
    hasQuery &&
    !isLoadingIndexes &&
    speciesResults.length === 0 &&
    taxaResults.length === 0 &&
    articleResults.length === 0 &&
    areaResults.length === 0;

  const SPECIES_INITIAL = 18;
  const visibleSpecies = showMoreSpecies
    ? speciesResults
    : speciesResults.slice(0, SPECIES_INITIAL);

  // ----- Render -----
  return (
    <div>
      {/* Header + search input */}
      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Search
        </h1>
        <p className="text-text-secondary mt-1.5 text-base">
          Search across species, articles, and nature areas in New England.
        </p>

        <div className="relative mt-5">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Try 'oak', 'warbler', or 'mushroom'…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowMoreSpecies(false);
            }}
            className="w-full pl-12 pr-4 py-3 text-base font-ui bg-card border-2 border-border rounded-xl focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 placeholder-text-muted"
            aria-label="Search species, articles, and nature areas"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-cream-dark text-text-muted hover:text-text-primary"
              aria-label="Clear search"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Filter toggles row */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-ui border transition-colors ${
              showFilters
                ? "bg-forest text-white border-forest"
                : "bg-card border-border hover:border-forest/40"
            }`}
            aria-expanded={showFilters}
            aria-controls="search-filters"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.293.707l-2 2A1 1 0 0110 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            Filters
            {filterCount > 0 && (
              <span className="ml-0.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {filterCount}
              </span>
            )}
          </button>

          <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />

          <label className="text-sm font-ui text-text-secondary flex items-center gap-1.5">
            <span className="sr-only">Sort by</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-card border border-border rounded-full px-3 py-1.5 text-sm font-ui focus:outline-none focus:border-forest"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="alphabetical">Sort: A-Z</option>
            </select>
          </label>

          {filterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm font-ui text-forest hover:text-forest-light underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div
            id="search-filters"
            className="mt-4 p-4 rounded-xl border border-border bg-cream-dark/40"
          >
            <FilterGroup label="Taxon group">
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const active = selectedGroups.has(g.key);
                  return (
                    <button
                      key={g.key}
                      onClick={() => toggleGroup(g.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-ui border transition-colors ${
                        active
                          ? "bg-forest text-white border-forest"
                          : "bg-card border-border hover:border-forest/40"
                      }`}
                    >
                      <GroupIcon groupKey={g.key} emoji={g.icon} size={14} />
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </FilterGroup>

            <FilterGroup label="Abundance">
              <div className="flex flex-wrap gap-2">
                {ABUNDANCE_TIERS.map(({ tier, label, icon }) => {
                  const active = selectedTiers.has(tier);
                  return (
                    <button
                      key={tier}
                      onClick={() => toggleTier(tier)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-ui border transition-colors ${
                        active
                          ? "bg-forest text-white border-forest"
                          : "bg-card border-border hover:border-forest/40"
                      }`}
                    >
                      <span aria-hidden="true">{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </FilterGroup>

            <FilterGroup label="Status" last>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "native", label: "Native only" },
                  { key: "introduced", label: "Introduced only" },
                  { key: "invasive", label: "Invasive only" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() =>
                      setNativeFilter(
                        key as "all" | "native" | "introduced" | "invasive"
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-ui border transition-colors ${
                      nativeFilter === key
                        ? "bg-forest text-white border-forest"
                        : "bg-card border-border hover:border-forest/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FilterGroup>
          </div>
        )}
      </header>

      {/* Body */}
      {!hasQuery ? (
        <EmptyPrompt
          recent={recentSearches}
          onPickRecent={(q) => setQuery(q)}
        />
      ) : isLoadingIndexes ? (
        <div className="text-text-muted text-center py-16">Loading search…</div>
      ) : noResults ? (
        <NoResults query={debouncedQuery} onClearFilters={clearFilters} hasFilters={filterCount > 0} />
      ) : (
        <div className="space-y-10">
          {/* Taxa (genera + families) */}
          {taxaResults.length > 0 && (
            <section>
              <SectionHeader
                title="Genera & families"
                count={taxaResults.length}
                icon="🌳"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {taxaResults.map((t) => (
                  <TaxonCard key={t.slug} entry={t} />
                ))}
              </div>
            </section>
          )}

          {/* Species */}
          {speciesResults.length > 0 && (
            <section>
              <SectionHeader
                title="Species"
                count={speciesResults.length}
                icon="🪶"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleSpecies.map((s) => (
                  <SpeciesCard
                    key={s.slug}
                    slug={s.slug}
                    commonName={s.commonName}
                    scientificName={s.scientificName}
                    family={s.family}
                    familyCommonName={s.familyCommonName}
                    thumbnailUrl={s.thumbnailUrl}
                    abundanceTier={s.abundanceTier || "moderate"}
                  />
                ))}
              </div>
              {!showMoreSpecies && speciesResults.length > SPECIES_INITIAL && (
                <div className="flex justify-center mt-5">
                  <button
                    onClick={() => setShowMoreSpecies(true)}
                    className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-ui font-medium text-text-primary hover:bg-cream-dark hover:border-forest/30 transition-colors"
                  >
                    Show {speciesResults.length - SPECIES_INITIAL} more species
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Articles */}
          {articleResults.length > 0 && (
            <section>
              <SectionHeader
                title="Articles"
                count={articleResults.length}
                icon="📖"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {articleResults.map((a) => (
                  <ArticleCard key={a.slug} entry={a} />
                ))}
              </div>
            </section>
          )}

          {/* Nature areas */}
          {areaResults.length > 0 && (
            <section>
              <SectionHeader
                title="Nature areas"
                count={areaResults.length}
                icon="🗺️"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {areaResults.map((a) => (
                  <AreaCard key={a.id} entry={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function FilterGroup({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-4"}>
      <div className="text-xs font-ui font-semibold text-text-muted uppercase tracking-wider mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  icon,
}: {
  title: string;
  count: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <h2 className="font-serif text-xl font-bold text-text-primary">
        {title}
      </h2>
      <span className="text-sm font-ui text-text-muted">({count})</span>
    </div>
  );
}

function TaxonCard({ entry }: { entry: SearchEntry }) {
  const icon = entry.type === "genus" ? "🌳" : "📂";
  return (
    <Link
      href={`/${entry.slug}`}
      className="block bg-card rounded-xl border border-border p-4 hover:-translate-y-0.5 hover:shadow-md hover:border-forest/30 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-serif font-semibold text-text-primary capitalize">
            {entry.commonName}
          </div>
          <div className="text-xs italic text-text-secondary">
            {entry.scientificName}
          </div>
        </div>
        <span className="ml-auto text-xs font-ui text-text-muted">
          {entry.type}
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({ entry }: { entry: ArticleSearchEntry }) {
  return (
    <Link
      href={`/learn/${entry.slug}`}
      className="block bg-card rounded-xl border border-border p-4 hover:-translate-y-0.5 hover:shadow-md hover:border-forest/30 transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0" aria-hidden="true">
          {entry.icon}
        </span>
        <div className="min-w-0">
          <div className="font-serif font-semibold text-text-primary">
            {entry.title}
          </div>
          <div className="text-sm text-text-secondary mt-0.5">
            {entry.subtitle}
          </div>
          {entry.preview && (
            <div className="text-xs text-text-muted mt-2 line-clamp-2">
              {entry.preview}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function AreaCard({ entry }: { entry: AreaSearchEntry }) {
  return (
    <Link
      href={`/map?area=${encodeURIComponent(entry.id)}`}
      className="block bg-card rounded-xl border border-border p-4 hover:-translate-y-0.5 hover:shadow-md hover:border-forest/30 transition-all"
    >
      <div className="font-serif font-semibold text-text-primary">
        {entry.name}
      </div>
      <div className="text-xs text-text-secondary mt-0.5">
        {entry.state} · {entry.owner}
      </div>
      <div className="text-xs text-text-muted font-ui mt-1">
        {entry.acreage.toLocaleString()} acres · {entry.purpose}
      </div>
    </Link>
  );
}

function EmptyPrompt({
  recent,
  onPickRecent,
}: {
  recent: string[];
  onPickRecent: (q: string) => void;
}) {
  const suggestions = ["oak", "warbler", "fern", "mushroom", "hawk", "turtle"];
  return (
    <div className="py-8">
      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-lg font-bold text-text-primary mb-3">
            Recent searches
          </h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => onPickRecent(q)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-ui hover:border-forest/30 hover:bg-cream-dark transition-colors"
              >
                <span aria-hidden="true">🕒</span>
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-serif text-lg font-bold text-text-primary mb-3">
          Try searching for…
        </h2>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPickRecent(s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-ui hover:border-forest/30 hover:bg-cream-dark transition-colors"
            >
              <span aria-hidden="true">✨</span>
              {s}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function NoResults({
  query,
  onClearFilters,
  hasFilters,
}: {
  query: string;
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-3" aria-hidden="true">
        🔍
      </div>
      <h2 className="font-serif text-xl font-bold text-text-primary">
        No results for &ldquo;{query}&rdquo;
      </h2>
      <p className="text-text-secondary mt-2 max-w-md mx-auto">
        Try a different spelling or a simpler term. You can also search for
        common names, scientific names, genera, or families.
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 px-5 py-2 rounded-xl bg-forest text-white text-sm font-ui font-medium hover:bg-forest-light transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

