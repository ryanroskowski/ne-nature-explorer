"use client";

/**
 * Shared split-pane species panel — used by explore, map, browse, compare,
 * and common pages to open a species detail panel on the right instead of
 * navigating to /species/[slug] on desktop.
 *
 * Each page provides its own storageKey so panel state doesn't leak between
 * pages (e.g., opening a species on /common shouldn't re-appear on /compare).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SpeciesData, ContextualArticle } from "@/lib/types";

interface SpeciesPanelState {
  selectedSlug: string | null;
  speciesData: SpeciesData | null;
  articlesData: ContextualArticle[];
  /** Server-rendered range-map SVG HTML, or null if no range data exists. */
  rangeMapHtml: string | null;
  loading: boolean;
  isDesktop: boolean;
  showPanel: boolean; // convenience: selectedSlug !== null && isDesktop
  selectSpecies: (slug: string) => void;
  closePanel: () => void;
}

const SpeciesPanelContext = createContext<SpeciesPanelState | null>(null);

export function useSpeciesPanel(): SpeciesPanelState | null {
  return useContext(SpeciesPanelContext);
}

interface SpeciesPanelProviderProps {
  children: React.ReactNode;
  /** Unique key per page so sessionStorage doesn't collide. */
  storageKey: string;
  /** Initial slug from URL ?species= param, read server-side. */
  initialSpecies?: string;
}

export function SpeciesPanelProvider({
  children,
  storageKey,
  initialSpecies,
}: SpeciesPanelProviderProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialSpecies || null
  );
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null);
  const [articlesData, setArticlesData] = useState<ContextualArticle[]>([]);
  const [rangeMapHtml, setRangeMapHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Track the current in-flight fetch so fast clicks don't race
  const fetchIdRef = useRef(0);

  // Desktop detection (match existing explore threshold)
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const selectSpecies = useCallback(
    async (slug: string) => {
      setSelectedSlug(slug);
      setLoading(true);
      setSpeciesData(null);
      setArticlesData([]);
      setRangeMapHtml(null);

      // Scroll to top so the split-pane fills the viewport
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

      // Persist selection so it survives back-navigation from /species/[slug]
      try {
        sessionStorage.setItem(storageKey, slug);
      } catch {}

      // Update URL without navigation (adds ?species=slug)
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("species", slug);
        window.history.pushState({}, "", url.toString());
      } catch {}

      const fetchId = ++fetchIdRef.current;
      try {
        const res = await fetch(`/api/species/${slug}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // Ignore stale results
        if (fetchIdRef.current !== fetchId) return;
        setSpeciesData(data.species);
        setArticlesData(data.articles || []);
        setRangeMapHtml(data.rangeMapHtml ?? null);
      } catch {
        if (fetchIdRef.current === fetchId) {
          setSpeciesData(null);
          setArticlesData([]);
          setRangeMapHtml(null);
        }
      } finally {
        if (fetchIdRef.current === fetchId) {
          setLoading(false);
        }
      }
    },
    [storageKey]
  );

  const closePanel = useCallback(() => {
    setSelectedSlug(null);
    setSpeciesData(null);
    setArticlesData([]);
    setRangeMapHtml(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("species");
      window.history.pushState({}, "", url.toString());
    } catch {}
  }, [storageKey]);

  // Browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("species");
      if (slug) {
        // Avoid re-fetching if already showing this slug
        if (slug !== selectedSlug) {
          selectSpecies(slug);
        }
      } else {
        setSelectedSlug(null);
        setSpeciesData(null);
        setArticlesData([]);
        setRangeMapHtml(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectSpecies, selectedSlug]);

  // Load initial species from URL or sessionStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSpecies = params.get("species");
    const savedSpecies = (() => {
      try {
        return sessionStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();
    const slug = urlSpecies || initialSpecies || savedSpecies;
    if (slug) {
      selectSpecies(slug);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showPanel = selectedSlug !== null && isDesktop;

  // Lock body scroll when panel is open on desktop (so the page doesn't
  // scroll behind the fixed split-pane)
  useEffect(() => {
    if (!showPanel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPanel]);

  const value: SpeciesPanelState = {
    selectedSlug,
    speciesData,
    articlesData,
    rangeMapHtml,
    loading,
    isDesktop,
    showPanel,
    selectSpecies,
    closePanel,
  };

  return (
    <SpeciesPanelContext.Provider value={value}>
      {children}
    </SpeciesPanelContext.Provider>
  );
}
