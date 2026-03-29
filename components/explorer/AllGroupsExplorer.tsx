"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { blurDataURL } from "@/lib/image-utils";
import GroupIcon from "@/components/ui/GroupIcon";
import SpeciesDetailPanel from "./SpeciesDetailPanel";
import SpeciesDetailSkeleton from "./SpeciesDetailSkeleton";
import type { TaxonomyNode, GroupInfo, SpeciesData, ContextualArticle } from "@/lib/types";

const STORAGE_KEY = "tree-of-life-expanded-ids";
const SPECIES_PANEL_KEY = "tree-of-life-selected-species";
const SCROLL_KEY = "tree-of-life-scroll-pos";
const TREE_SCROLL_KEY = "tree-of-life-tree-scroll";
const FLATTEN_KEY = "tree-of-life-flattened-ids";

const rankColors: Record<string, string> = {
  kingdom: "text-text-primary",
  phylum: "text-text-primary",
  subphylum: "text-text-primary",
  class: "text-forest-dark",
  order: "text-forest",
  family: "text-teal",
  genus: "text-gold",
  species: "text-text-primary",
};

const rankLabels: Record<string, string> = {
  kingdom: "Kingdom",
  phylum: "Phylum",
  subphylum: "Subphylum",
  class: "Class",
  order: "Order",
  family: "Family",
  genus: "Genus",
  species: "Species",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countNodes(node: TaxonomyNode, rank: string): number {
  let count = node.rank === rank ? 1 : 0;
  for (const child of node.children) {
    count += countNodes(child, rank);
  }
  return count;
}

/** Collect all node IDs under a tree (for expand-all) */
function collectAllIds(node: TaxonomyNode, ids: Set<number>) {
  ids.add(node.id);
  for (const child of node.children) collectAllIds(child, ids);
}

/** Expand first 2 levels of a tree */
function expandLevels(node: TaxonomyNode, depth: number, ids: Set<number>) {
  if (depth < 2) {
    ids.add(node.id);
    for (const child of node.children) expandLevels(child, depth + 1, ids);
  }
}

/** Collect all species leaf nodes under a given node */
function collectAllSpecies(node: TaxonomyNode): TaxonomyNode[] {
  if (node.rank === "species") return [node];
  const species: TaxonomyNode[] = [];
  for (const child of node.children) {
    species.push(...collectAllSpecies(child));
  }
  return species;
}

interface AllGroupsExplorerProps {
  allTrees: { group: GroupInfo; tree: TaxonomyNode }[];
  initialGroup?: string;
  initialSpecies?: string;
}

// ── Species node (leaf) ──────────────────────────────────────
function SpeciesNode({
  node,
  onSelectSpecies,
  isDesktop,
  selectedSlug,
}: {
  node: TaxonomyNode;
  onSelectSpecies?: (slug: string) => void;
  isDesktop?: boolean;
  selectedSlug?: string | null;
}) {
  const slug = slugify(node.name);
  const isSelected = selectedSlug === slug;

  return (
    <Link
      href={`/species/${slug}`}
      onClick={
        onSelectSpecies && isDesktop
          ? (e) => {
              e.preventDefault();
              onSelectSpecies(slug);
            }
          : undefined
      }
      className={`group flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
        isSelected
          ? "bg-forest/10 border-l-2 border-forest -ml-[2px]"
          : "hover:bg-forest/5"
      }`}
    >
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-cream-dark shrink-0">
        {node.representativePhotoUrl ? (
          <Image
            src={node.representativePhotoUrl}
            alt={node.commonName}
            fill
            className="object-cover"
            sizes="40px"
            placeholder="blur"
            blurDataURL={blurDataURL}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            🌿
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-serif font-medium text-text-primary group-hover:text-forest transition-colors capitalize">
          {node.commonName}
        </span>
        <span className="text-xs italic text-text-secondary ml-2 hidden sm:inline">
          {node.name}
        </span>
      </div>
      <svg
        className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Link>
  );
}

// ── Inner taxonomy node (non-root) ───────────────────────────
function InnerNode({
  node,
  depth,
  expandedIds,
  onToggle,
  flattenedIds,
  onToggleFlatten,
  onSelectSpecies,
  isDesktop,
  selectedSlug,
}: {
  node: TaxonomyNode;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  flattenedIds: Set<number>;
  onToggleFlatten: (id: number) => void;
  onSelectSpecies?: (slug: string) => void;
  isDesktop?: boolean;
  selectedSlug?: string | null;
}) {
  const isExpanded = expandedIds.has(node.id);
  const isFlattened = flattenedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSpecies = node.rank === "species";
  const colorClass = rankColors[node.rank] || "text-text-primary";
  // Only show flatten for nodes with grandchildren (not genus which directly holds species)
  const hasGrandchildren = hasChildren && node.children.some(c => c.rank !== "species");

  if (isSpecies) return <SpeciesNode node={node} onSelectSpecies={onSelectSpecies} isDesktop={isDesktop} selectedSlug={selectedSlug} />;

  return (
    <div>
      <button
        onClick={() => hasChildren && onToggle(node.id)}
        className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl transition-colors ${
          hasChildren ? "hover:bg-cream-dark cursor-pointer" : "cursor-default"
        }`}
      >
        {hasChildren && (
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 text-text-muted"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.span>
        )}
        {!hasChildren && <span className="w-4 shrink-0" />}

        <span className={`font-serif font-semibold ${colorClass} capitalize`}>
          {node.commonName}
        </span>

        {node.commonName.toLowerCase() !== node.name.toLowerCase() && (
          <span className="text-xs italic text-text-secondary hidden sm:inline">
            ({node.name})
          </span>
        )}

        <span className="text-xs font-ui text-text-muted bg-cream-dark px-1.5 py-0.5 rounded hidden sm:inline">
          {rankLabels[node.rank] || node.rank}
        </span>

        <span className="ml-auto text-xs font-ui text-text-muted shrink-0">
          {node.speciesCount} species
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (node.description || node.funFact) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-9 pr-3 pb-2 space-y-1">
              {node.description && (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {node.description}
                </p>
              )}
              {node.distinguishingFeatures && (
                <p className="text-xs text-teal leading-relaxed">
                  <span className="font-semibold">Key features:</span>{" "}
                  {node.distinguishingFeatures}
                </p>
              )}
              {node.funFact && (
                <p className="text-xs text-gold italic leading-relaxed">
                  💡 {node.funFact}
                </p>
              )}
              {(node.rank === "genus" || node.rank === "family") &&
                node.speciesCount >= 2 && (
                  <Link
                    href={`/compare/${slugify(node.commonName || node.name)}`}
                    className="inline-flex items-center gap-1 text-xs font-ui text-forest hover:text-forest-light mt-1"
                  >
                    Compare {node.speciesCount} species →
                  </Link>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Flatten toggle button */}
            {hasGrandchildren && node.speciesCount > 0 && (
              <div className="pl-9 pr-3 pb-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFlatten(node.id); }}
                  className={`inline-flex items-center gap-1.5 text-xs font-ui px-2.5 py-1 rounded-lg border transition-colors ${
                    isFlattened
                      ? "bg-forest/10 text-forest border-forest/30 hover:bg-forest/15"
                      : "text-text-secondary border-border hover:text-forest hover:border-forest/20 hover:bg-forest/5"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isFlattened ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M7 6h14M7 18h14" />
                    )}
                  </svg>
                  {isFlattened ? "Show hierarchy" : `Show all ${node.speciesCount} species`}
                </button>
              </div>
            )}

            <div
              className={`ml-3 pl-3 border-l-2 border-border ${depth > 3 ? "ml-2 pl-2" : ""}`}
            >
              {isFlattened ? (
                // Flat species list
                <div>
                  {collectAllSpecies(node).map((sp) => (
                    <SpeciesNode key={sp.id} node={sp} onSelectSpecies={onSelectSpecies} isDesktop={isDesktop} selectedSlug={selectedSlug} />
                  ))}
                </div>
              ) : (
                // Normal hierarchy
                node.children.map((child) => (
                  <InnerNode
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    flattenedIds={flattenedIds}
                    onToggleFlatten={onToggleFlatten}
                    onSelectSpecies={onSelectSpecies}
                    isDesktop={isDesktop}
                    selectedSlug={selectedSlug}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function AllGroupsExplorer({ allTrees, initialGroup, initialSpecies }: AllGroupsExplorerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // Try restoring from sessionStorage first
    try {
      const savedIds = sessionStorage.getItem(STORAGE_KEY);
      if (savedIds) {
        const ids = JSON.parse(savedIds) as number[];
        if (Array.isArray(ids) && ids.length > 0) {
          return new Set(ids);
        }
      }
    } catch {}

    // Fallback: expand the requested group (or first group) to 2 levels
    const target = initialGroup
      ? allTrees.find((t) => t.group.key === initialGroup)
      : null;
    const ids = new Set<number>();
    if (target) {
      expandLevels(target.tree, 0, ids);
    } else if (allTrees.length > 0) {
      expandLevels(allTrees[0].tree, 0, ids);
    }
    return ids;
  });
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const treePanelRef = useRef<HTMLDivElement>(null);

  // Restore scroll position on mount (page scroll or tree panel scroll)
  useEffect(() => {
    try {
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      if (savedScroll) {
        const pos = parseInt(savedScroll, 10);
        setTimeout(() => {
          window.scrollTo(0, pos);
        }, 100);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save scroll position (debounced) — both page and tree panel
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        } catch {}
      }, 150);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  function persistIds(ids: Set<number>) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {}
  }

  const handleToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistIds(next);
      return next;
    });
  }, []);

  // Flattened nodes state — which nodes are showing all species flat
  const [flattenedIds, setFlattenedIds] = useState<Set<number>>(() => {
    try {
      const saved = sessionStorage.getItem(FLATTEN_KEY);
      if (saved) {
        const ids = JSON.parse(saved) as number[];
        if (Array.isArray(ids) && ids.length > 0) return new Set(ids);
      }
    } catch {}
    return new Set();
  });

  const handleToggleFlatten = useCallback((id: number) => {
    setFlattenedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try { sessionStorage.setItem(FLATTEN_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // ── Split-pane state ──────────────────────────────────────
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSpecies || null);
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null);
  const [articlesData, setArticlesData] = useState<ContextualArticle[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Desktop detection
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Fetch species data when selected
  const selectSpecies = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setPanelLoading(true);

    // Scroll page to top so the split-pane fills the viewport
    window.scrollTo({ top: 0, behavior: "instant" });

    // Persist selection so it survives navigation (back button from species page)
    try { sessionStorage.setItem(SPECIES_PANEL_KEY, slug); } catch {}

    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set("species", slug);
    window.history.pushState({}, "", url.toString());

    try {
      const res = await fetch(`/api/species/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSpeciesData(data.species);
      setArticlesData(data.articles || []);
    } catch {
      setSpeciesData(null);
      setArticlesData([]);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedSlug(null);
    setSpeciesData(null);
    setArticlesData([]);
    try { sessionStorage.removeItem(SPECIES_PANEL_KEY); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.delete("species");
    window.history.pushState({}, "", url.toString());
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("species");
      if (slug) {
        selectSpecies(slug);
      } else {
        setSelectedSlug(null);
        setSpeciesData(null);
        setArticlesData([]);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectSpecies]);

  // Load species panel on mount — check URL first, then sessionStorage fallback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSpecies = params.get("species");
    const savedSpecies = (() => { try { return sessionStorage.getItem(SPECIES_PANEL_KEY); } catch { return null; } })();
    const slug = urlSpecies || initialSpecies || savedSpecies;
    if (slug) {
      selectSpecies(slug);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSpecies = allTrees.reduce((s, t) => s + t.tree.speciesCount, 0);
  const showPanel = selectedSlug && isDesktop;

  // Measure header height to compute split-pane height
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState("80vh");

  useEffect(() => {
    if (!showPanel || !containerRef.current) return;
    const updateHeight = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setPanelHeight(`${window.innerHeight - rect.top - 16}px`);
      }
    };
    // Prevent page scroll when split-pane is open
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    // Recalculate after scroll and layout settle
    const t = setTimeout(() => updateHeight(), 50);
    window.addEventListener("resize", updateHeight);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateHeight);
      document.body.style.overflow = "";
    };
  }, [showPanel]);

  // Save/restore tree panel scroll position (for split-pane mode)
  useEffect(() => {
    const panel = treePanelRef.current;
    if (!panel || !showPanel) return;

    // Restore saved tree scroll position
    try {
      const saved = sessionStorage.getItem(TREE_SCROLL_KEY);
      if (saved) {
        setTimeout(() => { panel.scrollTop = parseInt(saved, 10); }, 100);
      }
    } catch {}

    // Save tree scroll on scroll (debounced)
    let tid: ReturnType<typeof setTimeout>;
    const handleTreeScroll = () => {
      clearTimeout(tid);
      tid = setTimeout(() => {
        try { sessionStorage.setItem(TREE_SCROLL_KEY, String(panel.scrollTop)); } catch {}
      }, 150);
    };
    panel.addEventListener("scroll", handleTreeScroll, { passive: true });
    return () => {
      panel.removeEventListener("scroll", handleTreeScroll);
      clearTimeout(tid);
    };
  }, [showPanel]);

  return (
    <div
      ref={containerRef}
      className={
        showPanel
          ? "grid grid-cols-[minmax(300px,2fr)_minmax(400px,3fr)] gap-4"
          : ""
      }
      style={showPanel ? { height: panelHeight } : undefined}
    >
      {/* Tree panel (left side on desktop split-pane) */}
      <div ref={treePanelRef} className={showPanel ? "overflow-y-auto min-h-0 split-pane-scroll" : ""}>
      {/* Controls — above card when no panel, inside card when split-pane */}
      {!showPanel && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => {
              const all = new Set<number>();
              for (const { tree } of allTrees) collectAllIds(tree, all);
              setExpandedIds(all);
              persistIds(all);
            }}
            className="text-xs font-ui text-forest hover:text-forest-light px-2.5 py-1 rounded-lg border border-forest/20 hover:bg-forest/5 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={() => {
              const empty = new Set<number>();
              setExpandedIds(empty);
              setFlattenedIds(empty);
              persistIds(empty);
              try { sessionStorage.setItem(FLATTEN_KEY, "[]"); } catch {}
            }}
            className="text-xs font-ui text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border hover:bg-cream-dark transition-colors"
          >
            Collapse All
          </button>
          <span className="ml-auto text-xs font-ui text-text-muted">
            {totalSpecies.toLocaleString()} species across {allTrees.length} groups
          </span>
        </div>
      )}

      {/* Unified tree */}
      <div className={`bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-1 ${showPanel ? "min-h-full" : ""}`}>
        {showPanel && (
          <div className="flex items-center gap-2 mb-2 -mt-1">
            <button
              onClick={() => {
                const all = new Set<number>();
                for (const { tree } of allTrees) collectAllIds(tree, all);
                setExpandedIds(all);
                persistIds(all);
              }}
              className="text-xs font-ui text-forest hover:text-forest-light px-2.5 py-1 rounded-lg border border-forest/20 hover:bg-forest/5 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={() => {
                const empty = new Set<number>();
                setExpandedIds(empty);
                setFlattenedIds(empty);
                persistIds(empty);
                try { sessionStorage.setItem(FLATTEN_KEY, "[]"); } catch {}
              }}
              className="text-xs font-ui text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border hover:bg-cream-dark transition-colors"
            >
              Collapse All
            </button>
            <span className="ml-auto text-xs font-ui text-text-muted">
              {totalSpecies.toLocaleString()} species
            </span>
          </div>
        )}
        {allTrees.map(({ group, tree }) => {
          const isExpanded = expandedIds.has(tree.id);
          const hasChildren = tree.children && tree.children.length > 0;

          return (
            <div
              key={group.key}
              ref={(el) => {
                groupRefs.current[group.key] = el;
              }}
              className="scroll-mt-20"
            >
              {/* Root group node */}
              <button
                onClick={() => handleToggle(tree.id)}
                className="w-full flex items-center gap-2 py-3 px-3 rounded-xl transition-colors hover:bg-cream-dark cursor-pointer"
              >
                {hasChildren && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="shrink-0 text-text-muted"
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </motion.span>
                )}

                <GroupIcon groupKey={group.key} emoji={group.icon} size={22} />

                <span className="font-serif font-semibold text-text-primary text-lg">
                  {group.label}
                </span>

                <span className="text-xs italic text-text-secondary hidden sm:inline">
                  ({tree.name})
                </span>

                <span className="text-xs font-ui text-text-muted bg-cream-dark px-1.5 py-0.5 rounded hidden sm:inline">
                  {rankLabels[tree.rank] || tree.rank}
                </span>

                <span className="ml-auto text-sm font-ui text-text-muted shrink-0">
                  {tree.speciesCount.toLocaleString()} species
                </span>
              </button>

              {/* Description when expanded */}
              <AnimatePresence>
                {isExpanded && (tree.description || tree.funFact) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-9 pr-3 pb-2 space-y-1">
                      {tree.description && (
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {tree.description}
                        </p>
                      )}
                      {tree.distinguishingFeatures && (
                        <p className="text-xs text-teal leading-relaxed">
                          <span className="font-semibold">Key features:</span>{" "}
                          {tree.distinguishingFeatures}
                        </p>
                      )}
                      {tree.funFact && (
                        <p className="text-xs text-gold italic leading-relaxed">
                          💡 {tree.funFact}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Children */}
              <AnimatePresence>
                {isExpanded && hasChildren && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Flatten toggle for root groups */}
                    {tree.children.some(c => c.rank !== "species") && tree.speciesCount > 0 && (
                      <div className="pl-9 pr-3 pb-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleFlatten(tree.id); }}
                          className={`inline-flex items-center gap-1.5 text-xs font-ui px-2.5 py-1 rounded-lg border transition-colors ${
                            flattenedIds.has(tree.id)
                              ? "bg-forest/10 text-forest border-forest/30 hover:bg-forest/15"
                              : "text-text-secondary border-border hover:text-forest hover:border-forest/20 hover:bg-forest/5"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {flattenedIds.has(tree.id) ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M7 6h14M7 18h14" />
                            )}
                          </svg>
                          {flattenedIds.has(tree.id) ? "Show hierarchy" : `Show all ${tree.speciesCount.toLocaleString()} species`}
                        </button>
                      </div>
                    )}
                    <div className="ml-3 pl-3 border-l-2 border-border">
                      {flattenedIds.has(tree.id) ? (
                        collectAllSpecies(tree).map((sp) => (
                          <SpeciesNode key={sp.id} node={sp} onSelectSpecies={selectSpecies} isDesktop={isDesktop} selectedSlug={selectedSlug} />
                        ))
                      ) : (
                        tree.children.map((child) => (
                          <InnerNode
                            key={child.id}
                            node={child}
                            depth={1}
                            expandedIds={expandedIds}
                            onToggle={handleToggle}
                            flattenedIds={flattenedIds}
                            onToggleFlatten={handleToggleFlatten}
                            onSelectSpecies={selectSpecies}
                            isDesktop={isDesktop}
                            selectedSlug={selectedSlug}
                          />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      </div>{/* end tree panel */}

      {/* Species detail panel (right side on desktop) */}
      <AnimatePresence>
        {showPanel && (
          panelLoading ? (
            <div className="bg-card border border-border rounded-2xl overflow-y-auto min-h-0 split-pane-scroll">
              <SpeciesDetailSkeleton />
            </div>
          ) : speciesData ? (
            <SpeciesDetailPanel
              key={speciesData.slug}
              species={speciesData}
              articles={articlesData}
              onClose={closePanel}
              onSelectSpecies={selectSpecies}
            />
          ) : null
        )}
      </AnimatePresence>
    </div>
  );
}
