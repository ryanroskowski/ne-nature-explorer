/**
 * Stage 11: Fetch plant pollinator data from GloBI
 * (Global Biotic Interactions — https://www.globalbioticinteractions.org)
 *
 * Uses real observed pollinator interaction records to determine
 * which pollinator types visit each plant species.
 *
 * GloBI aggregates data from iNaturalist, USDA, museum collections,
 * and academic publications. CC0 license.
 *
 * Output: data/pipeline/plants/pollinator-info.json
 */

import fs from "fs";
import path from "path";
import { getCached, setCache } from "./lib/cache";

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
  familyName?: string;
}

type PollinatorType =
  | "bees"
  | "butterflies"
  | "moths"
  | "hummingbirds"
  | "flies"
  | "beetles"
  | "wasps";

interface PollinatorInfo {
  pollinators: PollinatorType[];
  totalRecords: number;
}

const GLOBI_API = "https://api.globalbioticinteractions.org/interaction";
const CACHE_NAMESPACE = "plant_pollinators";
const RATE_LIMIT_MS = 200; // GloBI has no strict rate limit, but be polite

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Classify a pollinator from its taxonomic path */
function classifyPollinator(taxonPath: string): PollinatorType | null {
  const path = taxonPath.toLowerCase();

  // Bees (Apoidea superfamily)
  if (
    path.includes("apidae") ||
    path.includes("halictidae") ||
    path.includes("andrenidae") ||
    path.includes("megachilidae") ||
    path.includes("colletidae") ||
    path.includes("melittidae")
  ) {
    return "bees";
  }

  // Butterflies vs moths (both Lepidoptera)
  if (path.includes("lepidoptera")) {
    // Key butterfly families
    if (
      path.includes("nymphalidae") ||
      path.includes("papilionidae") ||
      path.includes("pieridae") ||
      path.includes("lycaenidae") ||
      path.includes("hesperiidae") ||
      path.includes("riodinidae")
    ) {
      return "butterflies";
    }
    // Sphinx/hawk moths are notable pollinators
    if (
      path.includes("sphingidae") ||
      path.includes("noctuidae") ||
      path.includes("erebidae") ||
      path.includes("geometridae") ||
      path.includes("saturniidae")
    ) {
      return "moths";
    }
    // Default lepidoptera to butterflies (more recognizable)
    return "butterflies";
  }

  // Flies (Diptera) — especially hoverflies (Syrphidae)
  if (path.includes("diptera") || path.includes("syrphidae")) {
    return "flies";
  }

  // Beetles (Coleoptera)
  if (path.includes("coleoptera")) {
    return "beetles";
  }

  // Hummingbirds (Trochilidae)
  if (path.includes("trochilidae") || path.includes("trochil")) {
    return "hummingbirds";
  }

  // Wasps (Vespidae, Sphecidae, etc.)
  if (
    path.includes("vespidae") ||
    path.includes("sphecidae") ||
    path.includes("pompilidae") ||
    path.includes("crabronidae") ||
    path.includes("mutillidae")
  ) {
    return "wasps";
  }

  // Generic Hymenoptera that aren't bees — likely wasps
  if (path.includes("hymenoptera")) {
    return "wasps";
  }

  return null;
}

async function fetchPollinators(scientificName: string): Promise<PollinatorInfo | null> {
  const url = `${GLOBI_API}?sourceTaxon=${encodeURIComponent(scientificName)}&interactionType=pollinatedBy&limit=200`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rows = data.data || [];
    if (rows.length === 0) return null;

    // Also check "visitedBy" for additional data
    const url2 = `${GLOBI_API}?sourceTaxon=${encodeURIComponent(scientificName)}&interactionType=hasPathogen&limit=0`;

    // Count pollinator types
    const typeCounts: Record<PollinatorType, number> = {
      bees: 0,
      butterflies: 0,
      moths: 0,
      hummingbirds: 0,
      flies: 0,
      beetles: 0,
      wasps: 0,
    };

    for (const row of rows) {
      const taxonPath = row[12] || ""; // target_taxon_path
      const type = classifyPollinator(taxonPath);
      if (type) typeCounts[type]++;
    }

    // Only include types with at least 1 record
    // Sort by record count (most common first)
    const pollinators = (Object.entries(typeCounts) as [PollinatorType, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    if (pollinators.length === 0) return null;

    return {
      pollinators,
      totalRecords: rows.length,
    };
  } catch {
    return null;
  }
}

/** Also fetch "flowersVisitedBy" (reverse: which insects visit this plant) */
async function fetchVisitors(scientificName: string): Promise<PollinatorInfo | null> {
  const url = `${GLOBI_API}?sourceTaxon=${encodeURIComponent(scientificName)}&interactionType=flowersVisitedBy&limit=200`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rows = data.data || [];
    if (rows.length === 0) return null;

    const typeCounts: Record<PollinatorType, number> = {
      bees: 0, butterflies: 0, moths: 0, hummingbirds: 0, flies: 0, beetles: 0, wasps: 0,
    };

    for (const row of rows) {
      const taxonPath = row[12] || "";
      const type = classifyPollinator(taxonPath);
      if (type) typeCounts[type]++;
    }

    const pollinators = (Object.entries(typeCounts) as [PollinatorType, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    if (pollinators.length === 0) return null;

    return { pollinators, totalRecords: rows.length };
  } catch {
    return null;
  }
}

/** Merge two PollinatorInfo results */
function mergeResults(a: PollinatorInfo | null, b: PollinatorInfo | null): PollinatorInfo | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  const types = new Set<PollinatorType>([...a.pollinators, ...b.pollinators]);
  // Keep order from the one with more data
  const primary = a.totalRecords >= b.totalRecords ? a : b;
  const pollinators = primary.pollinators.slice();
  for (const t of types) {
    if (!pollinators.includes(t)) pollinators.push(t);
  }

  return {
    pollinators,
    totalRecords: a.totalRecords + b.totalRecords,
  };
}

async function main() {
  console.log("\n=== Stage 11: Fetch Plant Pollinator Data (GloBI) ===\n");

  const pipelineDir = path.join(process.cwd(), "data", "pipeline", "plants");
  const speciesListPath = path.join(pipelineDir, "species-enriched.json");

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesListPath, "utf-8")
  );

  console.log(`Fetching pollinator data for ${speciesList.length} plant species...\n`);

  const outputPath = path.join(pipelineDir, "pollinator-info.json");
  const results: Record<string, PollinatorInfo> = {};

  let fetched = 0;
  let cached = 0;
  let withData = 0;
  let noData = 0;
  const pollinatorTotals: Record<string, number> = {};

  for (const species of speciesList) {
    const taxonKey = species.taxonId.toString();
    const cacheKey = `${CACHE_NAMESPACE}_${taxonKey}`;

    // Check cache
    const cachedResult = getCached<PollinatorInfo | null>(CACHE_NAMESPACE, cacheKey);
    if (cachedResult !== undefined && cachedResult !== null) {
      results[taxonKey] = cachedResult;
      cached++;
      if (cachedResult.pollinators.length > 0) withData++;
      continue;
    }
    // Check for cached "no data"
    const cachedEmpty = getCached<string>(CACHE_NAMESPACE, cacheKey + "_empty");
    if (cachedEmpty !== null) {
      cached++;
      noData++;
      continue;
    }

    // Fetch from GloBI: both "pollinatedBy" and "flowersVisitedBy"
    const [pollResult, visitResult] = await Promise.all([
      fetchPollinators(species.scientificName),
      fetchVisitors(species.scientificName),
    ]);
    await sleep(RATE_LIMIT_MS);

    const merged = mergeResults(pollResult, visitResult);

    if (merged && merged.pollinators.length > 0) {
      results[taxonKey] = merged;
      setCache(CACHE_NAMESPACE, cacheKey, merged);
      withData++;

      for (const p of merged.pollinators) {
        pollinatorTotals[p] = (pollinatorTotals[p] || 0) + 1;
      }

      console.log(
        `  ✓ ${species.commonName}: ${merged.pollinators.join(", ")} (${merged.totalRecords} records)`
      );
    } else {
      setCache(CACHE_NAMESPACE, cacheKey + "_empty", "none");
      noData++;
    }

    fetched++;

    // Save progress every 50 species
    if (fetched % 50 === 0) {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`  [saved progress: ${fetched} fetched, ${withData} with data, ${cached} cached]`);
    }
  }

  // Final save
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n=== Plant Pollinator Fetch Complete ===`);
  console.log(`  Total species: ${speciesList.length}`);
  console.log(`  Cached (skipped): ${cached}`);
  console.log(`  Fetched: ${fetched}`);
  console.log(`  With pollinator data: ${withData}`);
  console.log(`  No data: ${noData}`);
  console.log(`\n  Pollinator type coverage:`);
  Object.entries(pollinatorTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${k}: ${v} plant species`));
  console.log(`\n  Output: ${outputPath}\n`);
}

main().catch(console.error);
