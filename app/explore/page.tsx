import { getAllTaxonomyTrees } from "@/lib/data/taxonomy";
import AllGroupsExplorer from "@/components/explorer/AllGroupsExplorer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore the Tree of Life — NE Nature Explorer",
  description:
    "Navigate the tree of life from kingdom to species. Discover how species are related and what makes each group unique.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; species?: string; path?: string }>;
}) {
  const { group, species, path } = await searchParams;
  const allTrees = getAllTaxonomyTrees();

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl lg:max-w-[95vw]">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Explore", rank: "page", slug: "explore" },
        ]}
      />

      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Tree of Life Explorer
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          Navigate through the branches of life. Click any group to expand it
          and see what&apos;s inside. Every species in New England has a place in
          this tree.
        </p>
      </header>

      <AllGroupsExplorer
        allTrees={allTrees}
        initialGroup={group}
        initialSpecies={species}
        initialPath={path}
      />
    </div>
  );
}
