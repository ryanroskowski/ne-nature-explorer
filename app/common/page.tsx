import { getCommonality, getAvailableGroups } from "@/lib/data";
import CommonalityBrowser from "@/components/common/CommonalityBrowser";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import GroupTabs from "@/components/ui/GroupTabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Most Common Species — NE Nature Explorer",
  description: "Browse New England species sorted by how commonly they are encountered. Start with the most common and work your way out.",
};

export default async function CommonalityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group = "plants" } = await searchParams;
  const commonality = getCommonality(group);
  const groups = getAvailableGroups();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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

      <CommonalityBrowser species={commonality} />
    </div>
  );
}
