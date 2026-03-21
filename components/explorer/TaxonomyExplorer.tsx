"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { blurDataURL } from "@/lib/image-utils";
import type { TaxonomyNode } from "@/lib/types";

const STORAGE_KEY = "taxonomy-expanded-ids";
const SCROLL_KEY = "taxonomy-scroll-pos";

// Colors for different ranks
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

/** Find a node in the tree by slug path, auto-expanding parents */
function findNodePath(
  node: TaxonomyNode,
  targetSlug: string
): number[] | null {
  const nodeSlug = slugify(node.commonName || node.name);
  if (nodeSlug === targetSlug) return [node.id];

  for (const child of node.children) {
    const path = findNodePath(child, targetSlug);
    if (path) return [node.id, ...path];
  }
  return null;
}

function TaxonomyNodeComponent({
  node,
  depth = 0,
  expandedIds,
  onToggle,
}: {
  node: TaxonomyNode;
  depth?: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSpecies = node.rank === "species";
  const colorClass = rankColors[node.rank] || "text-text-primary";

  if (isSpecies) {
    return (
      <Link
        href={`/species/${slugify(node.name)}`}
        className="group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-forest/5 transition-colors"
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
        <svg className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

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

      {/* Description + fun fact when expanded */}
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
              {/* Link to compare for genus/family level */}
              {(node.rank === "genus" || node.rank === "family") && node.speciesCount >= 2 && (
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
            <div className={`ml-3 pl-3 border-l-2 border-border ${depth > 3 ? "ml-2 pl-2" : ""}`}>
              {node.children.map((child) => (
                <TaxonomyNodeComponent
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compute default expansion (first 2 levels + optional deep-link path) */
function getDefaultExpansion(tree: TaxonomyNode, initialExpandPath?: string): Set<number> {
  const initial = new Set<number>();

  function expandLevel(node: TaxonomyNode, depth: number) {
    if (depth < 2) {
      initial.add(node.id);
      for (const child of node.children) {
        expandLevel(child, depth + 1);
      }
    }
  }
  expandLevel(tree, 0);

  if (initialExpandPath) {
    const segments = initialExpandPath.split("/");
    const targetSlug = segments[segments.length - 1];
    const nodePath = findNodePath(tree, targetSlug);
    if (nodePath) {
      for (const id of nodePath) initial.add(id);
    }
  }

  return initial;
}

export default function TaxonomyExplorer({
  tree,
  initialExpandPath,
  storagePrefix,
}: {
  tree: TaxonomyNode;
  initialExpandPath?: string;
  storagePrefix?: string;
}) {
  // Use group-specific storage keys when embedded in AllGroupsExplorer
  const storageKey = storagePrefix ? `${STORAGE_KEY}-${storagePrefix}` : STORAGE_KEY;
  const scrollKey = storagePrefix ? `${SCROLL_KEY}-${storagePrefix}` : SCROLL_KEY;

  // Start with default expansion (avoids SSR hydration mismatch)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() =>
    getDefaultExpansion(tree, initialExpandPath)
  );

  // On mount: restore from sessionStorage if no deep-link path
  useEffect(() => {
    if (initialExpandPath) return; // deep-link takes priority

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const ids = JSON.parse(saved) as number[];
        if (Array.isArray(ids) && ids.length > 0) {
          setExpandedIds(new Set(ids));

          // Only restore scroll when NOT embedded (no storagePrefix)
          // The parent AllGroupsExplorer handles scroll restoration
          if (!storagePrefix) {
            const savedScroll = sessionStorage.getItem(scrollKey);
            if (savedScroll) {
              setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
              }, 150);
            }
          }
        }
      }
    } catch {
      // sessionStorage unavailable — use default
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save scroll position (debounced) — only when standalone (no storagePrefix)
  useEffect(() => {
    if (storagePrefix) return; // parent handles scroll
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem(scrollKey, String(window.scrollY));
        } catch {}
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [storagePrefix, scrollKey]);

  // Persist to sessionStorage — called directly from event handlers
  function persistIds(ids: Set<number>) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...ids]));
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

  // Expand all / collapse all
  function expandAll() {
    const all = new Set<number>();
    function walk(node: TaxonomyNode) {
      all.add(node.id);
      for (const child of node.children) walk(child);
    }
    walk(tree);
    setExpandedIds(all);
    persistIds(all);
  }

  function collapseAll() {
    const collapsed = new Set([tree.id]);
    setExpandedIds(collapsed);
    persistIds(collapsed);
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={expandAll}
          className="text-xs font-ui text-forest hover:text-forest-light px-2.5 py-1 rounded-lg border border-forest/20 hover:bg-forest/5 transition-colors"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-xs font-ui text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border hover:bg-cream-dark transition-colors"
        >
          Collapse All
        </button>
        <span className="ml-auto text-xs font-ui text-text-muted">
          {tree.speciesCount} species across{" "}
          {countNodes(tree, "family")} families
        </span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
        <TaxonomyNodeComponent
          node={tree}
          depth={0}
          expandedIds={expandedIds}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}

function countNodes(node: TaxonomyNode, rank: string): number {
  let count = node.rank === rank ? 1 : 0;
  for (const child of node.children) {
    count += countNodes(child, rank);
  }
  return count;
}
