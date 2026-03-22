import { getSeasonalGuide } from "@/lib/data/seasonal";
import SeasonalGuide from "@/components/browse/SeasonalGuide";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seasonal Guide — NE Nature Explorer",
  description: "A month-by-month guide to what's blooming, fruiting, and changing in New England.",
};

export default async function SeasonalPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group = "plants" } = await searchParams;
  const guide = getSeasonalGuide(group);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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

      <SeasonalGuide guide={guide} />
    </div>
  );
}
