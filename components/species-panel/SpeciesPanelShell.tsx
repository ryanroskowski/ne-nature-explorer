"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import SpeciesDetailPanel from "@/components/explorer/SpeciesDetailPanel";
import SpeciesDetailSkeleton from "@/components/explorer/SpeciesDetailSkeleton";
import { useSpeciesPanel } from "./SpeciesPanelContext";

interface SpeciesPanelShellProps {
  children: React.ReactNode;
  /**
   * Extra classes for the left (content) pane when the split-pane is active.
   * Defaults to `overflow-y-auto min-h-0 split-pane-scroll`.
   */
  leftPaneClassName?: string;
  /**
   * Extra classes for the outer wrapper when the split-pane is NOT active.
   * Useful when the parent expects the children to pass through unchanged.
   */
  className?: string;
}

/**
 * Wraps a page's content and renders a two-column CSS grid when a species
 * panel is open on desktop:
 *   [content pane | species detail panel]
 *
 * When no panel is open (or on mobile), children are rendered unchanged.
 *
 * The panel height is computed from the containerRef's position in the
 * viewport, so pages keep their normal header/breadcrumb layout above
 * the split-pane.
 */
export default function SpeciesPanelShell({
  children,
  leftPaneClassName,
  className,
}: SpeciesPanelShellProps) {
  const panel = useSpeciesPanel();
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState("80vh");

  const showPanel = !!panel?.showPanel;

  // Compute panel height based on where the container sits in the viewport
  useEffect(() => {
    if (!showPanel || !containerRef.current) return;
    const updateHeight = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setPanelHeight(`${window.innerHeight - rect.top - 16}px`);
      }
    };
    window.scrollTo(0, 0);
    const t = setTimeout(updateHeight, 50);
    window.addEventListener("resize", updateHeight);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateHeight);
    };
  }, [showPanel]);

  if (!showPanel) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-[minmax(300px,2fr)_minmax(400px,3fr)] gap-4"
      style={{ height: panelHeight }}
    >
      <div
        className={
          leftPaneClassName ||
          "overflow-y-auto min-h-0 split-pane-scroll"
        }
      >
        {children}
      </div>

      <div className="min-h-0">
        <AnimatePresence mode="wait">
          {panel.loading || !panel.speciesData ? (
            <div
              key="skeleton"
              className="h-full overflow-y-auto bg-card border border-border rounded-2xl"
            >
              <SpeciesDetailSkeleton />
            </div>
          ) : (
            <SpeciesDetailPanel
              key={panel.selectedSlug}
              species={panel.speciesData}
              articles={panel.articlesData}
              rangeMapHtml={panel.rangeMapHtml}
              onClose={panel.closePanel}
              onSelectSpecies={panel.selectSpecies}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
