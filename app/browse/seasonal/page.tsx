import { getSeasonalGuide } from "@/lib/data/seasonal";
import SeasonalGuide from "@/components/browse/SeasonalGuide";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import SpeciesPanelShell from "@/components/species-panel/SpeciesPanelShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seasonal Guide — NE Nature Explorer",
  description: "A month-by-month guide to what's blooming, fruiting, and changing in New England.",
};

export default async function SeasonalPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; species?: string }>;
}) {
  const { group = "plants", species } = await searchParams;
  const guide = getSeasonalGuide(group);

  return (
    <SpeciesPanelProvider storageKey="species-panel-seasonal" initialSpecies={species}>
      <div className="mx-auto px-4 sm:px-6 py-8 max-w-7xl lg:max-w-[95vw]">
        <Breadcrumbs
          items={[
            { label: "Home", rank: "page", slug: "" },
            { label: "Browse", rank: "page", slug: "browse" },
            { label: "Seasonal Guide", rank: "page", slug: "browse/seasonal" },
          ]}
        />

        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            What to Look For
          </h1>
          <p className="text-text-secondary mt-2 text-lg max-w-2xl">
            A month-by-month guide to what&apos;s blooming, fruiting, and changing in New England.
          </p>
        </header>

        <SpeciesPanelShell>
          <SeasonalGuide guide={guide} />
        </SpeciesPanelShell>
      </div>
    </SpeciesPanelProvider>
  );
}
