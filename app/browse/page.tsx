import Link from "next/link";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import GroupTabs from "@/components/ui/GroupTabs";
import { getGroupBrowseConfig } from "@/lib/trait-configs";
import { getGroupInfo, getAvailableGroups } from "@/lib/data/groups";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse — NE Nature Explorer",
  description: "Browse New England species by visual traits, characteristics, or what's happening seasonally.",
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group = "plants" } = await searchParams;
  const config = getGroupBrowseConfig(group);
  const groupInfo = getGroupInfo(group);
  const groupLabel = groupInfo?.label || "Plants";
  const groups = getAvailableGroups();

  // Propagate group to browse card links
  const groupSuffix = group !== "plants" ? `?group=${group}` : "";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Browse", rank: "page", slug: "browse" },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Browse {groupLabel}
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          Explore New England&apos;s {groupLabel.toLowerCase()} by visual traits, characteristics, or what&apos;s happening right now in the field.
        </p>
      </header>

      <GroupTabs groups={groups} currentGroup={group} />

      <div className="grid gap-4 sm:gap-6">
        {config.browseCards.map((card) => (
          <Link
            key={card.href}
            href={`${card.href}${groupSuffix}`}
            className="group block bg-card border border-border rounded-2xl p-6 sm:p-8 hover:border-forest/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start gap-4 sm:gap-6">
              <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${card.color}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-text-primary group-hover:text-forest transition-colors">
                  {card.title}
                </h2>
                <p className="text-text-secondary mt-1">
                  {card.description}
                </p>
                <p className="text-sm text-text-muted mt-3 italic">
                  e.g. {card.examples}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
