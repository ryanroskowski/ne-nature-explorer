import { getAllSpecies, getAvailableGroups } from "@/lib/data";
import type { Metadata } from "next";
import ComparePageClient from "@/components/compare/ComparePageClient";
import GenusSearch from "@/components/compare/GenusSearch";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import GroupTabs from "@/components/ui/GroupTabs";

export const metadata: Metadata = {
  title: "Compare Species — NE Nature Explorer",
  description: "Compare species within the same genus or family. See what makes each one unique.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group = "plants" } = await searchParams;
  const groups = getAvailableGroups();

  // Load all species and filter by group
  const allSpecies = getAllSpecies().filter(
    (s) => (s.group || "plants") === group
  );

  // Group species by genus
  const byGenus = new Map<string, typeof allSpecies>();
  for (const s of allSpecies) {
    const genus = s.genus;
    if (!byGenus.has(genus)) byGenus.set(genus, []);
    byGenus.get(genus)!.push(s);
  }

  // Only show genera with 2+ species
  const comparableGenera = Array.from(byGenus.entries())
    .filter(([, species]) => species.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  // Serialize species data for client components
  const genusGroups = comparableGenera.map(([genus, species]) => ({
    genus,
    genusCommonName: species[0].genusCommonName || genus,
    family: species[0].family,
    familyCommonName: species[0].familyCommonName,
    compareHints: species[0].compareHints,
    species: species.map(s => ({
      slug: s.slug,
      commonName: s.commonName,
      scientificName: s.scientificName,
      family: s.family,
      familyCommonName: s.familyCommonName,
      abundanceTier: s.abundanceTier,
      observationCount: s.observationCount,
      habitat: s.habitat,
      funFact: s.funFact,
      idTips: s.idTips,
      photos: s.photos,
    })),
  }));

  // Simplified data for the search component
  const searchGroups = genusGroups.map((g) => ({
    genus: g.genus,
    genusCommonName: g.genusCommonName,
    family: g.family,
    familyCommonName: g.familyCommonName,
    speciesCount: g.species.length,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Compare", rank: "page", slug: "compare" },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Compare Species
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          See related species side by side. Understanding how similar species
          differ is one of the best ways to sharpen your identification skills.
        </p>
      </header>

      <GroupTabs groups={groups} currentGroup={group} />

      {/* Search for genera */}
      <div className="mb-8">
        <GenusSearch groups={searchGroups} />
      </div>

      {comparableGenera.length === 0 ? (
        <p className="text-text-secondary">
          No genera with multiple species found yet.
        </p>
      ) : (
        <ComparePageClient groups={genusGroups} />
      )}
    </div>
  );
}
