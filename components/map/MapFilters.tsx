"use client";

import { useState } from "react";

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

export default function MapFilters({
  filters,
  onFiltersChange,
  totalAreas,
}: MapFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 left-3 right-14 z-10">
      {/* Search bar + toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search nature areas..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
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
