/**
 * Fetch monthly field guide data from iNaturalist.
 *
 * For each active group × each month (1-12), fetches the top 30 most-observed
 * species from iNaturalist in New England, cross-references with our species
 * database, computes arrivals/departures, and writes data/monthly-guide.json.
 *
 * Usage: npx tsx scripts/fetch-monthly-guide.ts
 *
 * API calls: ~8 groups × 12 months = 96 calls (~2.5 min)
 * Cost: $0 (iNaturalist API is free)
 */

import fs from "fs";
import path from "path";
import { fetchSpeciesCountsByMonth } from "./lib/inaturalist";
import { TAXON_GROUPS } from "./lib/groups";
import type { INatSpeciesCount } from "./lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SPECIES_DIR = path.join(DATA_DIR, "species");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SEASON: Record<number, string> = {
  1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer",
  7: "summer", 8: "summer", 9: "fall", 10: "fall", 11: "fall", 12: "winter",
};

interface MonthlySpeciesEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  abundanceTier: string;
  observationCount: number;
  note: string;
  isNewArrival: boolean;
  isDepartingSoon: boolean;
}

interface MonthlyMonthData {
  totalObservations: number;
  species: MonthlySpeciesEntry[];
}

interface MonthlyGroupData {
  months: Record<string, MonthlyMonthData>;
}

interface MonthlyGuide {
  generatedAt: string;
  groups: Record<string, MonthlyGroupData>;
}

// Build taxonId → species data lookup from our species files
function buildTaxonLookup(): Map<number, {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  abundanceTier: string;
  seasonality?: Record<string, string>;
}> {
  const lookup = new Map();
  const files = fs.readdirSync(SPECIES_DIR).filter(f => f.endsWith(".json"));

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SPECIES_DIR, file), "utf-8"));
      lookup.set(data.taxonId, {
        slug: data.slug,
        commonName: data.commonName,
        scientificName: data.scientificName,
        thumbnailUrl: data.photos?.[0]?.mediumUrl,
        abundanceTier: data.abundanceTier || "moderate",
        seasonality: data.seasonality,
      });
    } catch {
      // Skip malformed files
    }
  }

  return lookup;
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Monthly Field Guide — Data Fetcher     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Load active groups from groups.json
  const groupsPath = path.join(DATA_DIR, "groups.json");
  if (!fs.existsSync(groupsPath)) {
    console.error("No data/groups.json found. Run the main pipeline first.");
    process.exit(1);
  }
  const groupsMeta: Record<string, { key: string; status: string }> =
    JSON.parse(fs.readFileSync(groupsPath, "utf-8"));

  const activeGroups = Object.entries(groupsMeta)
    .filter(([, g]) => g.status === "active")
    .map(([key]) => key);

  console.log(`Active groups: ${activeGroups.join(", ")}`);
  console.log(`Total API calls needed: ${activeGroups.length * 12}\n`);

  // Build taxon ID lookup from species files
  console.log("Building taxon ID → species lookup...");
  const taxonLookup = buildTaxonLookup();
  console.log(`  ${taxonLookup.size} species in database\n`);

  const guide: MonthlyGuide = {
    generatedAt: new Date().toISOString(),
    groups: {},
  };

  for (const groupKey of activeGroups) {
    const config = TAXON_GROUPS[groupKey];
    if (!config) {
      console.warn(`  No config for group "${groupKey}", skipping`);
      continue;
    }

    console.log(`\n=== ${config.label} ===`);

    // For composite groups (like insects), we need to fetch each subgroup
    // and merge results. For simple groups, just use the taxonId.
    const taxonIds: number[] = [];
    if (config.subgroups) {
      for (const sg of config.subgroups) {
        taxonIds.push(sg.taxonId);
      }
    } else if (config.taxonId) {
      taxonIds.push(config.taxonId);
    } else {
      console.warn(`  No taxonId for group "${groupKey}", skipping`);
      continue;
    }

    const groupData: MonthlyGroupData = { months: {} };

    // Collect all months' top species (keyed by taxonId) for arrival/departure calc
    const monthTopSets: Map<number, Set<number>> = new Map();

    for (let month = 1; month <= 12; month++) {
      console.log(`  ${MONTH_NAMES[month - 1]}...`);

      // Fetch species counts, merging subgroups if needed
      const allCounts: INatSpeciesCount[] = [];
      for (const taxonId of taxonIds) {
        const counts = await fetchSpeciesCountsByMonth(taxonId, month, 30);
        allCounts.push(...counts);
      }

      // Sort by count descending and take top 30 across all subgroups
      allCounts.sort((a, b) => b.count - a.count);
      const top = allCounts.slice(0, 30);

      // Track which taxon IDs are in this month's top list
      const topTaxonIds = new Set(top.map(c => c.taxon.id));
      monthTopSets.set(month, topTaxonIds);

      // Map to our species database
      const season = MONTH_SEASON[month];
      let totalObs = 0;
      const species: MonthlySpeciesEntry[] = [];

      for (const entry of top) {
        totalObs += entry.count;
        const ourSpecies = taxonLookup.get(entry.taxon.id);

        if (ourSpecies) {
          // Get season-specific note from our AI-generated content
          const note = ourSpecies.seasonality?.[season] || "";

          species.push({
            slug: ourSpecies.slug,
            commonName: ourSpecies.commonName,
            scientificName: ourSpecies.scientificName,
            thumbnailUrl: ourSpecies.thumbnailUrl,
            abundanceTier: ourSpecies.abundanceTier,
            observationCount: entry.count,
            note: note.length > 200 ? note.substring(0, 197) + "..." : note,
            isNewArrival: false, // computed in second pass
            isDepartingSoon: false, // computed in second pass
          });
        } else {
          // Species not in our DB — include with iNaturalist data
          species.push({
            slug: entry.taxon.preferred_common_name
              ? slugify(entry.taxon.name)
              : slugify(entry.taxon.name),
            commonName: entry.taxon.preferred_common_name || entry.taxon.name,
            scientificName: entry.taxon.name,
            thumbnailUrl: entry.taxon.default_photo?.medium_url,
            abundanceTier: "moderate",
            observationCount: entry.count,
            note: "",
            isNewArrival: false,
            isDepartingSoon: false,
          });
        }
      }

      groupData.months[month.toString()] = { totalObservations: totalObs, species };
      console.log(`    ${species.length} species (${totalObs.toLocaleString()} obs)`);
    }

    // Second pass: compute arrivals and departures
    for (let month = 1; month <= 12; month++) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const nextMonth = month === 12 ? 1 : month + 1;
      const currentSet = monthTopSets.get(month)!;
      const prevSet = monthTopSets.get(prevMonth)!;
      const nextSet = monthTopSets.get(nextMonth)!;

      const monthData = groupData.months[month.toString()];
      for (const sp of monthData.species) {
        // Find this species' taxon ID to check sets
        const taxonId = findTaxonId(sp.slug, sp.scientificName, taxonLookup);
        if (taxonId !== null) {
          sp.isNewArrival = currentSet.has(taxonId) && !prevSet.has(taxonId);
          sp.isDepartingSoon = currentSet.has(taxonId) && !nextSet.has(taxonId);
        }
      }
    }

    guide.groups[groupKey] = groupData;
    console.log(`  Done — 12 months processed`);
  }

  // Write output
  const outputPath = path.join(DATA_DIR, "monthly-guide.json");
  fs.writeFileSync(outputPath, JSON.stringify(guide, null, 2));
  console.log(`\n✓ Written to ${outputPath}`);
  console.log(`  ${Object.keys(guide.groups).length} groups × 12 months`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findTaxonId(
  slug: string,
  scientificName: string,
  lookup: Map<number, { slug: string; scientificName: string }>
): number | null {
  for (const [taxonId, data] of lookup) {
    if (data.slug === slug || data.scientificName === scientificName) {
      return taxonId;
    }
  }
  return null;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
