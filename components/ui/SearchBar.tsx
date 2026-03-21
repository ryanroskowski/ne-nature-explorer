"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import GroupIcon from "@/components/ui/GroupIcon";
import type { SearchEntry } from "@/lib/types";

// Search index cached globally (all groups merged)
let searchIndex: SearchEntry[] | null = null;
let fuseInstance: Fuse<SearchEntry> | null = null;

async function loadSearchIndex(): Promise<Fuse<SearchEntry>> {
  if (fuseInstance) return fuseInstance;

  const res = await fetch("/api/search-index");
  searchIndex = await res.json();

  fuseInstance = new Fuse(searchIndex!, {
    keys: [
      { name: "commonName", weight: 0.5 },
      { name: "scientificName", weight: 0.3 },
      { name: "familyCommonName", weight: 0.1 },
      { name: "genus", weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
  });
  return fuseInstance;
}

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

const typeIcons: Record<string, string> = {
  species: "🌿",
  genus: "🌳",
  family: "📂",
};

export default function SearchBar() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const listboxId = "search-results-listbox";

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const fuse = await loadSearchIndex();
      const fuseResults = fuse.search(query, { limit: 8 });
      setResults(fuseResults.map((r) => r.item));
      setIsOpen(true);
      setSelectedIndex(-1);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(entry: SearchEntry) {
    setIsOpen(false);
    setQuery("");
    if (entry.type === "species") {
      router.push(`/species/${entry.slug}`);
    } else {
      // For explore links, propagate group from current URL
      const group = searchParams.get("group");
      const groupSuffix = group && group !== "plants" ? `?group=${group}` : "";
      router.push(`/${entry.slug}${groupSuffix}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      navigate(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
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
          placeholder="Search species..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
          aria-autocomplete="list"
          aria-label="Search species by name"
          className="w-full pl-8 pr-3 py-1.5 text-sm font-ui bg-card border border-border rounded-lg focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/20 placeholder-text-muted"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
        >
          {results.map((entry, i) => (
            <button
              key={entry.slug}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => navigate(entry)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-forest/5"
                  : "hover:bg-cream-dark"
              }`}
            >
              <span className="text-base shrink-0">
                {entry.type === "species"
                  ? <GroupIcon groupKey={entry.group || "plants"} emoji={GROUP_ICONS[entry.group || "plants"]} size={18} />
                  : <span aria-hidden="true">{typeIcons[entry.type] || "🌿"}</span>}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-text-primary truncate">
                  {entry.commonName}
                </div>
                <div className="text-xs text-text-secondary italic truncate">
                  {entry.scientificName}
                </div>
              </div>
              <span className="ml-auto text-xs text-text-muted font-ui shrink-0">
                {entry.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
