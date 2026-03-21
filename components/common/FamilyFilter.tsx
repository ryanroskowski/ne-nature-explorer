"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface FamilyFilterProps {
  families: { family: string; commonName: string; count: number }[];
  totalCount: number;
  selected: string;
  onSelect: (family: string) => void;
}

export default function FamilyFilter({
  families,
  totalCount,
  selected,
  onSelect,
}: FamilyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return families;
    const q = query.toLowerCase();
    return families.filter(
      (f) =>
        f.commonName.toLowerCase().includes(q) ||
        f.family.toLowerCase().includes(q)
    );
  }, [families, query]);

  const selectedLabel =
    selected === "all"
      ? `All families (${totalCount})`
      : families.find((f) => f.family === selected)?.commonName || selected;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-ui font-medium transition-colors border ${
          selected !== "all"
            ? "bg-forest text-white border-forest"
            : "bg-card border-border text-text-primary hover:bg-cream-dark"
        }`}
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span>{selectedLabel}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-30 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search families..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-cream text-sm font-ui text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
            />
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {/* All option */}
            <button
              onClick={() => {
                onSelect("all");
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-ui transition-colors hover:bg-cream-dark ${
                selected === "all"
                  ? "bg-forest/10 text-forest font-semibold"
                  : "text-text-primary"
              }`}
            >
              All families
              <span className="text-text-muted ml-1">({totalCount})</span>
            </button>

            {filtered.map((f) => (
              <button
                key={f.family}
                onClick={() => {
                  onSelect(f.family);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm font-ui transition-colors hover:bg-cream-dark ${
                  selected === f.family
                    ? "bg-forest/10 text-forest font-semibold"
                    : "text-text-primary"
                }`}
              >
                {f.commonName}
                <span className="text-text-muted ml-1">({f.count})</span>
              </button>
            ))}

            {query && filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-text-muted">
                No families matching &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
