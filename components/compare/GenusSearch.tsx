"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface GenusSearchProps {
  groups: {
    genus: string;
    genusCommonName: string;
    family: string;
    familyCommonName: string;
    speciesCount: number;
  }[];
}

export default function GenusSearch({ groups }: GenusSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups.slice(0, 12);
    const q = query.toLowerCase();
    return groups
      .filter(
        (g) =>
          g.genusCommonName.toLowerCase().includes(q) ||
          g.genus.toLowerCase().includes(q) ||
          g.familyCommonName.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [groups, query]);

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search genera to compare..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm font-ui text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-30 max-h-80 overflow-y-auto">
          {filtered.map((g) => (
            <Link
              key={g.genus}
              href={`/compare/${slugify(g.genusCommonName || g.genus)}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-cream-dark transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div>
                <span className="font-serif font-semibold text-sm text-text-primary capitalize">
                  {g.genusCommonName}
                </span>
                <span className="text-xs italic text-text-secondary ml-2">
                  {g.genus}
                </span>
              </div>
              <span className="text-xs font-ui text-text-muted shrink-0 ml-3">
                {g.speciesCount} species
              </span>
            </Link>
          ))}
          {query && filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-muted">
              No genera found matching &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Quick stats below search */}
      <p className="text-xs text-text-muted mt-2">
        {groups.length} genera with 2+ species available to compare
      </p>
    </div>
  );
}
