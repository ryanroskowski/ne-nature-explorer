import { getBrowseIndex } from "@/lib/data/browse";
import { getGroupBrowseConfig } from "@/lib/trait-configs";
import { getGroupInfo, getAvailableGroups } from "@/lib/data/groups";
import TraitBrowser from "@/components/browse/TraitBrowser";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import Link from "next/link";
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
  const config = getGroupBrowseConfig(group);
  const groupInfo = getGroupInfo(group);
  const groupLabel = groupInfo?.label || "Species";
  const allGroups = getAvailableGroups().filter((g) => g.status === "active");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Browse", rank: "page", slug: `browse?group=${group}` },
          { label: "Traits", rank: "page", slug: `browse/traits?group=${group}` },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          {config.traitBrowseTitle}
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          {config.traitBrowseDescription}
        </p>
        <p className="text-sm text-text-muted mt-1">
          {entries.length} {groupLabel.toLowerCase()} species
        </p>
      </header>

      {/* Group switcher */}
      <div className="flex flex-wrap gap-2 mb-8">
        {allGroups.map((g) => (
          <Link
            key={g.key}
            href={`/browse/traits?group=${g.key}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-ui transition-colors ${
              g.key === group
                ? "bg-forest text-white"
                : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80"
            }`}
          >
            <span>{g.icon}</span>
            {g.label}
          </Link>
        ))}
      </div>

      <TraitBrowser entries={entries} config={config} />
    </div>
  );
}
