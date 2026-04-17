import { Suspense } from "react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import SearchPageClient from "@/components/search/SearchPageClient";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import SpeciesPanelShell from "@/components/species-panel/SpeciesPanelShell";
import { getAvailableGroups } from "@/lib/data/groups";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search — NE Nature Explorer",
  description:
    "Search across 10,000+ New England species, articles, and nature areas. Filter by taxon group, abundance, native/invasive status, and more.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; species?: string; groups?: string }>;
}) {
  const { q = "", species } = await searchParams;
  const groups = getAvailableGroups();

  return (
    <SpeciesPanelProvider
      storageKey="species-panel-search"
      initialSpecies={species}
    >
      <div className="mx-auto px-4 sm:px-6 py-8 max-w-7xl lg:max-w-[95vw]">
        <Breadcrumbs
          items={[
            { label: "Home", rank: "page", slug: "" },
            { label: "Search", rank: "page", slug: "search" },
          ]}
        />

        <SpeciesPanelShell>
          <Suspense fallback={<div className="text-text-muted">Loading…</div>}>
            <SearchPageClient initialQuery={q} groups={groups} />
          </Suspense>
        </SpeciesPanelShell>
      </div>
    </SpeciesPanelProvider>
  );
}
