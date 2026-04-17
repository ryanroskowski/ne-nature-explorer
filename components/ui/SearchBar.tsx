"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
      { name: "alternativeNames", weight: 0.35 },
      { name: "scientificName", weight: 0.3 },
      { name: "familyCommonName", weight: 0.1 },
      { name: "genus", weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
  });
  return fuseInstance;
}

// Exposed so other components (e.g. the /search page) can reuse the same
// Fuse instance without re-fetching the index.
export async function getSearchFuse(): Promise<Fuse<SearchEntry>> {
  return loadSearchIndex();
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

// Maximum results to show in the dropdown. Extra results are reachable via
// the "See all results" footer link, which takes the user to /search.
const DROPDOWN_LIMIT = 7;

export default function SearchBar() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const listboxId = "search-results-listbox";

  useEffect(() => {
    // Debounced fuzzy search — effect syncs results/state to the query string.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (query.length < 2) {
      setResults([]);
      setTotalMatches(0);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const fuse = await loadSearchIndex();
      // Fetch a wider net so we know the true match count for the footer.
      const allResults = fuse.search(query, { limit: 50 });
      setTotalMatches(allResults.length);
      setResults(allResults.slice(0, DROPDOWN_LIMIT).map((r) => r.item));
      setIsOpen(true);
      setSelectedIndex(-1);
    }, 150);

    return () => clearTimeout(timer);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query]);

  // Global keyboard shortcut: "/" focuses the search box (ignored when typing
  // in another input or when modifiers are held).
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

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

  function goToSearchPage() {
    if (query.trim().length < 2) return;
    setIsOpen(false);
    const q = encodeURIComponent(query.trim());
    setQuery("");
    router.push(`/search?q=${q}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // "See all results" is the last selectable row in the dropdown.
    const seeAllIndex = results.length;
    const maxIndex = totalMatches > results.length ? seeAllIndex : results.length - 1;

    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim().length >= 2) {
        e.preventDefault();
        goToSearchPage();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        navigate(results[selectedIndex]);
      } else {
        // Either nothing selected, or "See all results" is selected.
        e.preventDefault();
        goToSearchPage();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showSeeAll = totalMatches > results.length;
  const seeAllIndex = results.length;

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
          className="w-full pl-8 pr-10 py-1.5 text-sm font-ui bg-card border border-border rounded-lg focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/20 placeholder-text-muted"
        />
        <kbd
          className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded border border-border bg-cream-dark text-[10px] font-ui text-text-muted pointer-events-none"
          aria-hidden="true"
          title="Press / to focus search"
        >
          /
        </kbd>
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[340px] max-w-[440px]"
        >
          {results.map((entry, i) => (
            <button
              key={entry.slug}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => navigate(entry)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors border-b border-border/40 last:border-b-0 ${
                i === selectedIndex ? "bg-forest/5" : "hover:bg-cream-dark"
              }`}
            >
              <span className="shrink-0 w-8 h-8 rounded-md overflow-hidden bg-cream-dark flex items-center justify-center">
                {entry.type === "species" && entry.thumbnailUrl ? (
                  <Image
                    src={entry.thumbnailUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : entry.type === "species" ? (
                  <GroupIcon
                    groupKey={entry.group || "plants"}
                    emoji={GROUP_ICONS[entry.group || "plants"]}
                    size={18}
                  />
                ) : (
                  <span className="text-base" aria-hidden="true">
                    {typeIcons[entry.type]}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
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

          {showSeeAll && (
            <button
              id={`search-result-${seeAllIndex}`}
              role="option"
              aria-selected={selectedIndex === seeAllIndex}
              onClick={goToSearchPage}
              onMouseEnter={() => setSelectedIndex(seeAllIndex)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-ui transition-colors border-t border-border ${
                selectedIndex === seeAllIndex
                  ? "bg-forest/10 text-forest"
                  : "bg-cream-dark/60 text-forest hover:bg-forest/5"
              }`}
            >
              <span aria-hidden="true">🔎</span>
              <span className="font-medium">
                See all {totalMatches} results for
              </span>
              <span className="font-medium italic truncate">
                &ldquo;{query}&rdquo;
              </span>
              <span className="ml-auto" aria-hidden="true">
                →
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
