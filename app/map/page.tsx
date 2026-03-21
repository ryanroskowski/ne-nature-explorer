import { getNatureAreas, getSpeciesIndex } from "@/lib/data";
import NatureMapLoader from "@/components/map/NatureMapLoader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nature Map — NE Nature Explorer",
  description:
    "Explore nature areas, parks, and reservations across New England. See what species you can find at each location.",
};

export default function MapPage() {
  const areasData = getNatureAreas();
  const speciesIndex = getSpeciesIndex();

  if (!areasData) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="text-center text-text-muted">
          <p>Map data not yet generated.</p>
          <p className="text-sm mt-2">
            Run{" "}
            <code className="bg-cream-dark px-1 rounded">
              npx tsx scripts/fetch-nature-areas.ts
            </code>{" "}
            to generate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <NatureMapLoader
      areas={areasData.areas}
      speciesIndex={speciesIndex}
    />
  );
}
