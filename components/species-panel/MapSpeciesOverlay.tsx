"use client";

import { AnimatePresence, motion } from "framer-motion";
import SpeciesDetailPanel from "@/components/explorer/SpeciesDetailPanel";
import SpeciesDetailSkeleton from "@/components/explorer/SpeciesDetailSkeleton";
import { useSpeciesPanel } from "./SpeciesPanelContext";

/**
 * Absolute-positioned species panel overlay for the map page.
 *
 * The map has its own layout (full-screen absolute positioning) so the
 * grid-based SpeciesPanelShell doesn't fit. This renders the species panel
 * on the left of the AreaDetailPanel (which lives at right-0 w-96).
 *
 * On mobile, renders full-width to cover the map like a modal.
 */
export default function MapSpeciesOverlay({
  /** Whether the AreaDetailPanel is currently open (panel sits on top of or next to it). */
  areaPanelOpen,
}: {
  areaPanelOpen: boolean;
}) {
  const panel = useSpeciesPanel();

  if (!panel || !panel.showPanel) return null;

  // Desktop: sit to the left of the AreaDetailPanel (which is right-0 w-96 = 24rem).
  //   If no area panel is open, anchor to the right edge instead.
  // Mobile: fill the screen — the provider already disables showPanel on small screens,
  //   but add a fallback class just in case.
  const desktopPosition = areaPanelOpen
    ? "lg:right-96 lg:w-[480px]"
    : "lg:right-0 lg:w-[480px]";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="map-species-panel"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`absolute top-0 right-0 bottom-0 left-0 ${desktopPosition} lg:left-auto bg-card border-l border-border shadow-xl z-30 overflow-y-auto`}
      >
        {panel.loading || !panel.speciesData ? (
          <SpeciesDetailSkeleton />
        ) : (
          <SpeciesDetailPanel
            species={panel.speciesData}
            articles={panel.articlesData}
            onClose={panel.closePanel}
            onSelectSpecies={panel.selectSpecies}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
