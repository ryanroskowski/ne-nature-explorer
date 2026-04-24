import { getAllSpecies } from "@/lib/data/species";
import CompareGroup from "@/components/compare/CompareGroup";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import Link from "next/link";
import type { Metadata } from "next";
import { SpeciesPanelProvider } from "@/components/species-panel/SpeciesPanelContext";
import SpeciesPanelShell from "@/components/species-panel/SpeciesPanelShell";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ group: string }>;
}): Promise<Metadata> {
  const { group } = await params;
  const allSpecies = getAllSpecies();

  // Find matching genus or family
  const match = findGroup(allSpecies, group);
  const label = match
    ? `${match.genusCommonName} (${match.genus})`
    : group;

  const title = `Compare ${label}`;
  const description = `Compare species in the ${label} group side by side. See key identification differences.`;
  const imageUrl = match?.species[0]?.photos?.[0]?.largeUrl;

  return {
    title,
    description,
    alternates: {
      canonical: `/compare/${group}`,
    },
    openGraph: {
      title,
      description,
      url: `/compare/${group}`,
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 900, alt: `${label} species` }],
      }),
    },
  };
}

function findGroup(
  allSpecies: ReturnType<typeof getAllSpecies>,
  groupSlug: string
) {
  // Try genus match first
  const byGenus = new Map<string, typeof allSpecies>();
  for (const s of allSpecies) {
    const slug = slugify(s.genusCommonName || s.genus);
    if (!byGenus.has(slug)) byGenus.set(slug, []);
    byGenus.get(slug)!.push(s);
  }

  if (byGenus.has(groupSlug)) {
    const species = byGenus.get(groupSlug)!;
    return {
      type: "genus" as const,
      genus: species[0].genus,
      genusCommonName: species[0].genusCommonName || species[0].genus,
      family: species[0].family,
      familyCommonName: species[0].familyCommonName,
      species,
    };
  }

  // Try family match
  const byFamily = new Map<string, typeof allSpecies>();
  for (const s of allSpecies) {
    const slug = slugify(s.familyCommonName || s.family);
    if (!byFamily.has(slug)) byFamily.set(slug, []);
    byFamily.get(slug)!.push(s);
  }

  if (byFamily.has(groupSlug)) {
    const species = byFamily.get(groupSlug)!;
    return {
      type: "family" as const,
      genus: species[0].family,
      genusCommonName: species[0].familyCommonName || species[0].family,
      family: species[0].family,
      familyCommonName: species[0].familyCommonName,
      species,
    };
  }

  // Also try matching on raw genus/family name slugified
  for (const s of allSpecies) {
    if (slugify(s.genus) === groupSlug) {
      const species = allSpecies.filter((sp) => sp.genus === s.genus);
      return {
        type: "genus" as const,
        genus: s.genus,
        genusCommonName: s.genusCommonName || s.genus,
        family: s.family,
        familyCommonName: s.familyCommonName,
        species,
      };
    }
    if (slugify(s.family) === groupSlug) {
      const species = allSpecies.filter((sp) => sp.family === s.family);
      return {
        type: "family" as const,
        genus: s.family,
        genusCommonName: s.familyCommonName || s.family,
        family: s.family,
        familyCommonName: s.familyCommonName,
        species,
      };
    }
  }

  return null;
}

export const dynamicParams = false;

export function generateStaticParams() {
  // Pre-build all 15 group compare pages
  const groups = ["plants", "mammals", "amphibians", "reptiles", "birds", "lichens", "fungi", "insects", "arachnids", "fish", "mollusks", "crustaceans", "cnidarians", "myriapods", "echinoderms"];
  return groups.map((group) => ({ group }));
}

export default async function CompareGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: groupSlug } = await params;
  const allSpecies = getAllSpecies();
  const match = findGroup(allSpecies, groupSlug);

  if (!match || match.species.length < 2) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Compare", rank: "page", slug: "compare" },
            { label: groupSlug, rank: "page", slug: `compare/${groupSlug}` },
          ]}
        />
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-4">
          Group Not Found
        </h1>
        <p className="text-text-secondary mb-6">
          {match
            ? `Only ${match.species.length} species found — need at least 2 to compare.`
            : `No matching genus or family found for "${groupSlug}".`}
        </p>
        <Link
          href="/compare"
          className="text-forest hover:text-forest-light font-ui text-sm"
        >
          ← Back to all comparisons
        </Link>
      </div>
    );
  }

  // Build compareHints from the first species that has one
  const compareHints =
    match.species.find((s) => s.compareHints)?.compareHints || "";

  // Group by genus if this is a family-level match
  const genusGroups =
    match.type === "family"
      ? buildGenusGroups(match.species)
      : [buildSingleGroup(match)];

  const breadcrumbItems = [
    { label: "Compare", rank: "page", slug: "compare" },
    {
      label: match.genusCommonName,
      rank: match.type,
      slug: `compare/${groupSlug}`,
    },
  ];

  return (
    <SpeciesPanelProvider storageKey={`species-panel-compare-${groupSlug}`}>
      <div className="mx-auto px-4 sm:px-6 py-8 max-w-7xl lg:max-w-[95vw]">
        <Breadcrumbs items={breadcrumbItems} />

        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary capitalize">
            Compare {match.genusCommonName}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            <span className="italic">{match.genus}</span>
            {match.type === "genus" && (
              <span className="mx-2 text-text-muted">·</span>
            )}
            {match.type === "genus" && (
              <span>
                {match.familyCommonName} ({match.family})
              </span>
            )}
            <span className="mx-2 text-text-muted">·</span>
            <span>{match.species.length} species</span>
          </p>
        </header>

        <SpeciesPanelShell>
          <div>
            {genusGroups.map((g) => (
              <CompareGroup key={g.genus} group={g} />
            ))}

            <div className="mt-8 pt-6 border-t border-border">
              <Link
                href="/compare"
                className="text-forest hover:text-forest-light font-ui text-sm"
              >
                ← View all comparisons
              </Link>
            </div>
          </div>
        </SpeciesPanelShell>
      </div>
    </SpeciesPanelProvider>
  );
}

function buildSingleGroup(match: NonNullable<ReturnType<typeof findGroup>>) {
  const compareHints =
    match.species.find((s) => s.compareHints)?.compareHints || "";
  return {
    genus: match.genus,
    genusCommonName: match.genusCommonName,
    family: match.family,
    familyCommonName: match.familyCommonName,
    compareHints,
    species: match.species.map((s) => ({
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
  };
}

function buildGenusGroups(species: ReturnType<typeof getAllSpecies>) {
  const byGenus = new Map<string, typeof species>();
  for (const s of species) {
    if (!byGenus.has(s.genus)) byGenus.set(s.genus, []);
    byGenus.get(s.genus)!.push(s);
  }

  return Array.from(byGenus.entries())
    .filter(([, spp]) => spp.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([genus, spp]) => {
      const first = spp[0];
      return {
        genus,
        genusCommonName: first.genusCommonName || genus,
        family: first.family,
        familyCommonName: first.familyCommonName,
        compareHints: spp.find((s) => s.compareHints)?.compareHints || "",
        species: spp.map((s) => ({
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
      };
    });
}
