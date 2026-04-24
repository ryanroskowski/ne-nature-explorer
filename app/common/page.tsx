import { getCommonality } from "@/lib/data/commonality";
import { getAvailableGroups } from "@/lib/data/groups";
import CommonalityBrowser from "@/components/common/CommonalityBrowser";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import GroupTabs from "@/components/ui/GroupTabs";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import SpeciesPanelShell from "@/components/species-panel/SpeciesPanelShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Most Common Species — NE Nature Explorer",
  description: "Browse New England species sorted by how commonly they are encountered. Start with the most common and work your way out.",
  alternates: {
    canonical: "/common",
  },
};

export default async function CommonalityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; species?: string }>;
}) {
  const { group = "plants", species } = await searchParams;
  const commonality = getCommonality(group);
  const groups = getAvailableGroups();

  return (
    <SpeciesPanelProvider storageKey="species-panel-common" initialSpecies={species}>
      <div className="mx-auto px-4 sm:px-6 py-8 max-w-7xl lg:max-w-[95vw]">
        <Breadcrumbs
          items={[
            { label: "Home", rank: "page", slug: "" },
            { label: "Most Common", rank: "page", slug: "common" },
          ]}
        />

        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            Browse by Commonality
          </h1>
          <p className="text-text-secondary mt-2 text-lg max-w-2xl">
            Species sorted by how often they&apos;re observed in New England.
            Start with the most common — these are the ones you&apos;ll see first on any walk.
          </p>
        </header>

        <GroupTabs groups={groups} currentGroup={group} />

        <SpeciesPanelShell>
          <CommonalityBrowser species={commonality} />
        </SpeciesPanelShell>
      </div>
    </SpeciesPanelProvider>
  );
}
