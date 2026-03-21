"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { blurDataURL } from "@/lib/image-utils";
import GroupIcon from "@/components/ui/GroupIcon";
import type { TaxonomyNode, GroupInfo } from "@/lib/types";

const STORAGE_KEY = "tree-of-life-expanded-ids";
const SCROLL_KEY = "tree-of-life-scroll-pos";

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

interface AllGroupsExplorerProps {
  allTrees: { group: GroupInfo; tree: TaxonomyNode }[];
  initialGroup?: string;
}

// ── Species node (leaf) ──────────────────────────────────────
function SpeciesNode({ node }: { node: TaxonomyNode }) {
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
}: {
  node: TaxonomyNode;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSpecies = node.rank === "species";
  const colorClass = rankColors[node.rank] || "text-text-primary";

  if (isSpecies) return <SpeciesNode node={node} />;

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
            <div
              className={`ml-3 pl-3 border-l-2 border-border ${depth > 3 ? "ml-2 pl-2" : ""}`}
            >
              {node.children.map((child) => (
                <InnerNode
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

// ── Main component ───────────────────────────────────────────
export default function AllGroupsExplorer({ allTrees, initialGroup }: AllGroupsExplorerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // If a specific group is requested via ?group=, expand that one
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

  // Restore state from sessionStorage on mount, or scroll to initialGroup
  useEffect(() => {
    if (initialGroup) {
      // Deep-link from home page — scroll to the requested group
      setTimeout(() => {
        const el = groupRefs.current[initialGroup];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return;
    }

    try {
      const savedIds = sessionStorage.getItem(STORAGE_KEY);
      if (savedIds) {
        const ids = JSON.parse(savedIds) as number[];
        if (Array.isArray(ids) && ids.length > 0) {
          setExpandedIds(new Set(ids));
        }
      }
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }, 100);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save scroll position (debounced)
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

  const totalSpecies = allTrees.reduce((s, t) => s + t.tree.speciesCount, 0);

  return (
    <div>
      {/* Controls */}
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
            const roots = new Set(allTrees.map((t) => t.tree.id));
            setExpandedIds(roots);
            persistIds(roots);
          }}
          className="text-xs font-ui text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-lg border border-border hover:bg-cream-dark transition-colors"
        >
          Collapse All
        </button>
        <span className="ml-auto text-xs font-ui text-text-muted">
          {totalSpecies.toLocaleString()} species across {allTrees.length} groups
        </span>
      </div>

      {/* Unified tree */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-1">
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
                    <div className="ml-3 pl-3 border-l-2 border-border">
                      {tree.children.map((child) => (
                        <InnerNode
                          key={child.id}
                          node={child}
                          depth={1}
                          expandedIds={expandedIds}
                          onToggle={handleToggle}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
