import { getBrowseIndex } from "@/lib/data";
import TraitBrowser from "@/components/browse/TraitBrowser";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse by Traits — NE Nature Explorer",
  description: "Filter New England species by traits, habitat, and more.",
};

export default async function TraitBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group = "plants" } = await searchParams;
  const entries = getBrowseIndex(group);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Browse", rank: "page", slug: "browse" },
          { label: "Traits", rank: "page", slug: "browse/traits" },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Browse by Traits
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          Start with a category, then refine by specific traits, habitat, or native status.
        </p>
      </header>

      <TraitBrowser entries={entries} />
    </div>
  );
}
