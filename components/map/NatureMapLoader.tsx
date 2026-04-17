"use client";

import dynamic from "next/dynamic";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import type { NatureArea, SpeciesIndexData } from "@/lib/types";

const NatureMap = dynamic(() => import("./NatureMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full flex items-center justify-center bg-cream-dark"
      style={{ height: "calc(100vh - 64px)" }}
    >
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🗺️</div>
        <p className="text-text-muted font-ui text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

interface NatureMapLoaderProps {
  areas: NatureArea[];
  speciesIndex: SpeciesIndexData | null;
}

export default function NatureMapLoader({ areas, speciesIndex }: NatureMapLoaderProps) {
  return (
    <SpeciesPanelProvider storageKey="species-panel-map">
      <NatureMap areas={areas} speciesIndex={speciesIndex} />
    </SpeciesPanelProvider>
  );
}
