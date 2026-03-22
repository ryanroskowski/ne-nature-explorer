"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { NatureArea } from "@/lib/types";

interface MapFiltersProps {
  filters: {
    state: string;
    ownerType: string;
    minAcres: number;
    minSpecies: number;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  totalAreas: number;
  areas: NatureArea[];
  onSelectArea: (area: NatureArea) => void;
}

const STATE_OPTIONS = [
  { value: "all", label: "All States" },
  { value: "MA", label: "MA" },
  { value: "CT", label: "CT" },
  { value: "ME", label: "ME" },
  { value: "NH", label: "NH" },
  { value: "RI", label: "RI" },
  { value: "VT", label: "VT" },
];

const OWNER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "state", label: "State Parks" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "municipal", label: "Municipal" },
  { value: "federal", label: "Federal" },
];

const SIZE_OPTIONS = [
  { value: 0, label: "Any size" },
  { value: 50, label: "50+ acres" },
  { value: 200, label: "200+ acres" },
  { value: 500, label: "500+ acres" },
];

const SPECIES_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 10, label: "10+" },
  { value: 25, label: "25+" },
  { value: 50, label: "50+" },
];

const OWNER_TYPE_LABELS: Record<string, string> = {
  state: "State",
  federal: "Federal",
  nonprofit: "Nonprofit",
  municipal: "Municipal",
  other: "",
};

export default function MapFilters({
  filters,
  onFiltersChange,
  totalAreas,
  areas,
  onSelectArea,
}: MapFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<NatureArea[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build a quick lookup for suggestions (case-insensitive substring match)
  useEffect(() => {
    const q = filters.search.trim().toLowerCase();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const matches: NatureArea[] = [];
    for (const a of areas) {
      if (
        a.name.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q)
      ) {
        matches.push(a);
        if (matches.length >= 8) break;
      }
    }

    // Sort: starts-with first, then alphabetical
    matches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(-1);
  }, [filters.search, areas]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(area: NatureArea) {
    setShowSuggestions(false);
    onFiltersChange({ ...filters, search: area.name });
    onSelectArea(area);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Escape") setShowSuggestions(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="absolute top-3 left-3 right-14 z-10">
      {/* Search bar + toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search nature areas..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            onKeyDown={handleKeyDown}
            onFocus={() =>
              filters.search.length >= 2 &&
              suggestions.length > 0 &&
              setShowSuggestions(true)
            }
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="area-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              selectedIndex >= 0 ? `area-suggestion-${selectedIndex}` : undefined
            }
            className="w-full bg-white/95 backdrop-blur-sm border border-border rounded-xl px-4 py-2.5 pl-9 text-sm font-ui shadow-md focus:outline-none focus:ring-2 focus:ring-forest/40 text-text-primary placeholder:text-text-muted"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              id="area-suggestions"
              role="listbox"
              aria-label="Area suggestions"
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
            >
              {suggestions.map((area, i) => (
                <button
                  key={area.id}
                  id={`area-suggestion-${i}`}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => handleSelect(area)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-forest/10"
                      : "hover:bg-cream-dark"
                  }`}
                >
                  <span className="text-forest mt-0.5 shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-text-primary truncate">
                      {area.name}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {[
                        OWNER_TYPE_LABELS[area.ownerType],
                        area.owner !== "Unknown" ? area.owner : null,
                        area.state,
                        area.acreage > 0
                          ? `${Math.round(area.acreage).toLocaleString()} acres`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className={`shrink-0 bg-white/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2.5 shadow-md text-sm font-ui transition-colors ${
            expanded ? "bg-forest text-white border-forest" : "text-text-secondary hover:text-text-primary"
          }`}
          aria-label="Toggle filters"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="mt-2 bg-white/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-md">
          {/* State */}
          <div className="mb-3">
            <label className="text-xs font-ui font-medium text-text-secondary mb-1 block">
              State
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, state: opt.value })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-ui transition-colors ${
                    filters.state === opt.value
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Owner type */}
          <div className="mb-3">
            <label className="text-xs font-ui font-medium text-text-secondary mb-1 block">
              Owner Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OWNER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, ownerType: opt.value })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-ui transition-colors ${
                    filters.ownerType === opt.value
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size filter */}
          <div className="mb-2">
            <label className="text-xs font-ui font-medium text-text-secondary mb-1 block">
              Minimum Size
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, minAcres: opt.value })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-ui transition-colors ${
                    filters.minAcres === opt.value
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Species filter */}
          <div className="mb-2">
            <label className="text-xs font-ui font-medium text-text-secondary mb-1 block">
              Min. Species Observed
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SPECIES_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, minSpecies: opt.value })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-ui transition-colors ${
                    filters.minSpecies === opt.value
                      ? "bg-forest text-white"
                      : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <div className="text-xs text-text-muted font-ui pt-1 border-t border-border/50">
            Showing {totalAreas.toLocaleString()} areas
          </div>
        </div>
      )}
    </div>
  );
}
