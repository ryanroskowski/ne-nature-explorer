import { getBrowseIndex } from "@/lib/data/browse";
import FlowerBrowser from "@/components/browse/FlowerBrowser";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import SpeciesPanelShell from "@/components/species-panel/SpeciesPanelShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse by Flower — NE Nature Explorer",
  description: "Find New England plants by flower color, shape, and bloom season.",
};

export default async function FlowerBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ species?: string }>;
}) {
  const { species } = await searchParams;
  // Flower browser is plants-only — always load plants browse index
  const allEntries = getBrowseIndex("plants");
  // Only show species that have flowers
  const entries = allEntries.filter((e) => (e.traits.flowerColors || []).length > 0);

  return (
    <SpeciesPanelProvider storageKey="species-panel-flowers" initialSpecies={species}>
      <div className="mx-auto px-4 sm:px-6 py-8 max-w-7xl lg:max-w-[95vw]">
        <Breadcrumbs
          items={[
            { label: "Home", rank: "page", slug: "" },
            { label: "Browse", rank: "page", slug: "browse" },
            { label: "Flowers", rank: "page", slug: "browse/flowers" },
          ]}
        />

        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            Browse by Flower
          </h1>
          <p className="text-text-secondary mt-2 text-lg max-w-2xl">
            Pick a flower color to start, then narrow down by shape and bloom season.
          </p>
        </header>

        <SpeciesPanelShell>
          <FlowerBrowser entries={entries} />
        </SpeciesPanelShell>
      </div>
    </SpeciesPanelProvider>
  );
}
