/**
 * Stage 12: Classify introduced plants as invasive using GRIIS
 * (Global Register of Introduced and Invasive Species — via GBIF)
 *
 * Checks each introduced (isNative=false) plant against the GRIIS
 * United States dataset on GBIF. Species present in GRIIS are
 * classified as invasive in the US.
 *
 * GRIIS dataset: https://www.gbif.org/dataset/32ad19ed-6b89-447a-9242-795c0897f345
 * CC0 license (public domain).
 *
 * Output: data/pipeline/plants/invasive-status.json
 */

import fs from "fs";
import path from "path";
import { getCached, setCache } from "./lib/cache";

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
  isNative?: boolean;
}

interface InvasiveStatus {
  isInvasive: boolean;
  griisMatch?: string; // matched scientific name in GRIIS
}

const GRIIS_DATASET_KEY = "32ad19ed-6b89-447a-9242-795c0897f345";
const GBIF_API = "https://api.gbif.org/v1";
const CACHE_NAMESPACE = "griis_invasive";
const RATE_LIMIT_MS = 150; // GBIF is generous, but be polite

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if a species is in the GRIIS US dataset */
async function checkGriis(scientificName: string): Promise<InvasiveStatus> {
  // Search GRIIS dataset for this species
  const url = `${GBIF_API}/species/search?datasetKey=${GRIIS_DATASET_KEY}&q=${encodeURIComponent(scientificName)}&limit=5&rank=SPECIES`;

  try {
    const response = await fetch(url);
    if (!response.ok) return { isInvasive: false };

    const data = await response.json();
    const results = data.results || [];

    // Check for exact genus+species match
    const binomial = scientificName.split(" ").slice(0, 2).join(" ");
    for (const result of results) {
      const matchName = (result.canonicalName || "").split(" ").slice(0, 2).join(" ");
      if (matchName.toLowerCase() === binomial.toLowerCase() && result.rank === "SPECIES") {
        return {
          isInvasive: true,
          griisMatch: result.canonicalName || result.scientificName,
        };
      }
    }

    return { isInvasive: false };
  } catch {
    return { isInvasive: false };
  }
}

async function main() {
  console.log("=== Stage 12: Classify invasive plants (GRIIS) ===\n");

  // Load species list
  const pipelineDir = path.join("data", "pipeline", "plants");
  const speciesListPath = path.join(pipelineDir, "species-list.json");
  const traitsPath = path.join(pipelineDir, "species-traits.json");

  if (!fs.existsSync(speciesListPath)) {
    console.error("Missing species-list.json — run pipeline stages 01-02 first");
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(fs.readFileSync(speciesListPath, "utf-8"));

  // Load traits to get isNative status
  const traitsData: Record<string, { isNative?: boolean }> = fs.existsSync(traitsPath)
    ? JSON.parse(fs.readFileSync(traitsPath, "utf-8"))
    : {};

  // Filter to introduced species only
  const introducedSpecies = speciesList.filter((sp) => {
    const traits = traitsData[sp.taxonId.toString()];
    return traits && traits.isNative === false;
  });

  console.log(`Total plants: ${speciesList.length}`);
  console.log(`Introduced (non-native): ${introducedSpecies.length}`);
  console.log(`Checking against GRIIS US dataset...\n`);

  // Load existing results if any
  const outputPath = path.join(pipelineDir, "invasive-status.json");
  const results: Record<string, InvasiveStatus> = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf-8"))
    : {};

  let checked = 0;
  let invasiveCount = 0;
  let cachedCount = 0;
  let newChecks = 0;

  for (const species of introducedSpecies) {
    const key = species.taxonId.toString();

    // Check cache first
    const cached = await getCached<InvasiveStatus>(CACHE_NAMESPACE, species.scientificName);
    if (cached !== null) {
      results[key] = cached;
      if (cached.isInvasive) invasiveCount++;
      cachedCount++;
      checked++;
      continue;
    }

    // Query GRIIS
    const status = await checkGriis(species.scientificName);
    results[key] = status;

    // Cache the result
    await setCache(CACHE_NAMESPACE, species.scientificName, status);

    if (status.isInvasive) {
      invasiveCount++;
      console.log(`  ⚠ INVASIVE: ${species.commonName} (${species.scientificName})`);
    }

    newChecks++;
    checked++;

    // Progress update every 100 species
    if (newChecks % 100 === 0) {
      console.log(`  ... checked ${checked}/${introducedSpecies.length} (${invasiveCount} invasive so far)`);
      // Save intermediate results
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Final save
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n=== Results ===`);
  console.log(`Checked: ${checked} introduced species`);
  console.log(`Cached: ${cachedCount}, New API calls: ${newChecks}`);
  console.log(`Invasive: ${invasiveCount}`);
  console.log(`Non-invasive introduced: ${checked - invasiveCount}`);
  console.log(`\nOutput: ${outputPath}`);
}

main().catch(console.error);
