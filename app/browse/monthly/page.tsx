import { getMonthlyGuide } from "@/lib/data/seasonal";
import { getAvailableGroups } from "@/lib/data/groups";
import MonthlyGuide from "@/components/browse/MonthlyGuide";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monthly Field Guide — NE Nature Explorer",
  description: "What to look for each month across all groups — real observation data from iNaturalist.",
};

export default async function MonthlyGuidePage() {
  const guide = getMonthlyGuide();
  const groups = getAvailableGroups().filter((g) => g.status === "active");

  if (!guide) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", rank: "page", slug: "" },
            { label: "Browse", rank: "page", slug: "browse" },
            { label: "Monthly Guide", rank: "page", slug: "browse/monthly" },
          ]}
        />
        <div className="text-center py-16 text-text-muted">
          <p>Monthly guide data not yet generated.</p>
          <p className="text-sm mt-2">
            Run <code>npx tsx scripts/fetch-monthly-guide.ts</code> to generate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Browse", rank: "page", slug: "browse" },
          { label: "Monthly Field Guide", rank: "page", slug: "browse/monthly" },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Monthly Field Guide
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          What to look for each month across all groups — based on real
          observation data from New England.
        </p>
      </header>

      <MonthlyGuide guide={guide} groups={groups} />
    </div>
  );
}
