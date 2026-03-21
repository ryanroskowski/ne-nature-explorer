/**
 * Stage 1: Fetch species list from iNaturalist
 *
 * Fetches all species in a given taxonomic group observed in New England,
 * along with their observation counts (used for commonality ranking).
 *
 * Supports single-taxon groups (plants, birds, mammals, etc.) and composite
 * groups (insects = butterflies + odonata + bees + top moths/beetles).
 */

import fs from "fs";
import path from "path";
import { fetchSpeciesCounts } from "./lib/inaturalist";
import type { INatSpeciesCount, PipelineSpecies } from "./lib/types";
import type { TaxonGroupConfig } from "./lib/groups";

export async function fetchSpecies(
  groupKey: string,
  groupConfig: TaxonGroupConfig
): Promise<PipelineSpecies[]> {
  console.log("\n=== Stage 1: Fetch Species List ===");
  console.log(`Group: ${groupConfig.label} (${groupConfig.name})`);

  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  let speciesCounts: INatSpeciesCount[];

  if (groupConfig.subgroups && groupConfig.subgroups.length > 0) {
    // Composite group (e.g. insects): fetch each subgroup separately
    console.log(`Fetching ${groupConfig.subgroups.length} subgroups...`);
    const allCounts: INatSpeciesCount[] = [];
    const seenTaxonIds = new Set<number>();

    for (const sub of groupConfig.subgroups) {
      console.log(`\n  Subgroup: ${sub.name} (taxon ${sub.taxonId})`);
      const subCounts = await fetchSpeciesCounts(sub.taxonId);
      console.log(`  Found ${subCounts.length} species`);

      // Sort by observation count and cap if maxSpecies set
      let filtered = subCounts.sort((a, b) => b.count - a.count);
      if (sub.maxSpecies) {
        filtered = filtered.slice(0, sub.maxSpecies);
        console.log(`  Capped to top ${sub.maxSpecies} by observation count`);
      }

      // Deduplicate across subgroups
      for (const sc of filtered) {
        if (sc.taxon && !seenTaxonIds.has(sc.taxon.id)) {
          seenTaxonIds.add(sc.taxon.id);
          allCounts.push(sc);
        }
      }
    }

    speciesCounts = allCounts;
    console.log(`\nTotal unique species across subgroups: ${speciesCounts.length}`);
  } else if (groupConfig.taxonId) {
    // Single taxon group
    console.log(`Fetching species for taxon ${groupConfig.taxonId}...`);
    speciesCounts = await fetchSpeciesCounts(groupConfig.taxonId);
    console.log(`Found ${speciesCounts.length} species.`);
  } else {
    throw new Error(`Group "${groupKey}" has no taxonId and no subgroups`);
  }

  // Transform to pipeline format
  const species: PipelineSpecies[] = speciesCounts
    .filter(
      (sc) =>
        sc.taxon &&
        sc.taxon.rank === "species" &&
        sc.taxon.is_active !== false
    )
    .map((sc: INatSpeciesCount) => {
      const t = sc.taxon;
      return {
        taxonId: t.id,
        scientificName: t.name,
        commonName: t.preferred_common_name || t.name,
        rank: t.rank,
        observationCount: sc.count,
        globalObservationCount: t.observations_count || 0,
        ancestorIds: t.ancestor_ids || [],
        wikipediaUrl: t.wikipedia_url,
        defaultPhotoUrl: t.default_photo?.medium_url || t.default_photo?.url,
      };
    });

  console.log(`Filtered to ${species.length} active species-rank taxa.`);

  // Save intermediate output to group-namespaced directory
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "species-list.json");
  fs.writeFileSync(outputPath, JSON.stringify(species, null, 2));
  console.log(`Saved to ${outputPath}`);

  return species;
}

// Run directly
if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const groupConfig = groupResult?.config || TAXON_GROUPS.plants;

  fetchSpecies(groupKey, groupConfig)
    .then((species) => {
      console.log(`\nDone! ${species.length} species fetched.`);
      // Print a summary
      console.log("\nTop 10 by observation count:");
      species.slice(0, 10).forEach((s, i) => {
        console.log(
          `  ${i + 1}. ${s.commonName} (${s.scientificName}) — ${s.observationCount} observations`
        );
      });
    })
    .catch(console.error);
}
