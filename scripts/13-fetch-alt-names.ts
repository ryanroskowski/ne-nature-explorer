/**
 * Stage 13: Fetch alternative common names from iNaturalist
 *
 * Uses the iNaturalist taxa API with `all_names=true` to get all
 * English common names for each species. Stores names other than
 * the preferred_common_name as alternativeNames.
 *
 * Output: data/pipeline/{group}/alt-names.json
 *
 * Usage: npx tsx scripts/13-fetch-alt-names.ts [group]
 *   group defaults to "all" (processes every active group)
 */

import fs from "fs";
import path from "path";
import { getCached, setCache } from "./lib/cache";

const CACHE_NAMESPACE = "inat_alt_names";
const RATE_LIMIT_MS = 1100; // iNaturalist: 1 req/sec

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AltNamesResult {
  alternativeNames: string[];
}

async function fetchAltNames(taxonId: number, preferredName: string): Promise<AltNamesResult> {
  const url = `https://api.inaturalist.org/v1/taxa/${taxonId}?all_names=true&locale=en`;

  try {
    const response = await fetch(url);
    if (!response.ok) return { alternativeNames: [] };

    const data = await response.json();
    const taxon = data.results?.[0];
    if (!taxon?.names) return { alternativeNames: [] };

    const preferred = preferredName.toLowerCase();
    const altNames = taxon.names
      .filter((n: { locale: string; name: string; is_valid?: boolean }) =>
        n.locale === "en" && n.name.toLowerCase() !== preferred && n.is_valid !== false
      )
      .map((n: { name: string }) => n.name);

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    seen.add(preferred);
    const unique: string[] = [];
    for (const name of altNames) {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(name);
      }
    }

    return { alternativeNames: unique };
  } catch {
    return { alternativeNames: [] };
  }
}

async function processGroup(groupKey: string) {
  const pipelineDir = path.join("data", "pipeline", groupKey);
  const speciesListPath = path.join(pipelineDir, "species-list.json");

  if (!fs.existsSync(speciesListPath)) {
    console.log(`  Skipping ${groupKey} — no species-list.json`);
    return;
  }

  const speciesList: { taxonId: number; commonName: string; scientificName: string }[] =
    JSON.parse(fs.readFileSync(speciesListPath, "utf-8"));

  console.log(`\n  Processing ${groupKey}: ${speciesList.length} species`);

  // Load existing results
  const outputPath = path.join(pipelineDir, "alt-names.json");
  const results: Record<string, AltNamesResult> = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf-8"))
    : {};

  let fetched = 0;
  let cached = 0;
  let withAlts = 0;

  for (const species of speciesList) {
    const key = species.taxonId.toString();

    // Check cache
    const cacheKey = `${groupKey}_${species.taxonId}`;
    const cachedResult = await getCached<AltNamesResult>(CACHE_NAMESPACE, cacheKey);
    if (cachedResult !== null) {
      results[key] = cachedResult;
      if (cachedResult.alternativeNames.length > 0) withAlts++;
      cached++;
      continue;
    }

    // Fetch from iNaturalist
    const result = await fetchAltNames(species.taxonId, species.commonName);
    results[key] = result;
    await setCache(CACHE_NAMESPACE, cacheKey, result);

    if (result.alternativeNames.length > 0) {
      withAlts++;
      if (result.alternativeNames.length >= 2) {
        console.log(`    ${species.commonName}: ${result.alternativeNames.join(", ")}`);
      }
    }

    fetched++;

    if (fetched % 100 === 0) {
      console.log(`    ... ${fetched + cached}/${speciesList.length} (${withAlts} with alt names)`);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Final save
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`  ${groupKey}: ${fetched + cached} checked (${cached} cached, ${fetched} fetched), ${withAlts} with alternative names`);
}

async function main() {
  console.log("=== Stage 13: Fetch alternative common names ===\n");

  const targetGroup = process.argv[2] || "all";

  // Get available groups
  const groupsPath = path.join("data", "groups.json");
  const groupsObj: Record<string, { key: string; status: string }> = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));
  const activeGroups = Object.values(groupsObj).filter((g) => g.status === "active").map((g) => g.key);

  const groupsToProcess = targetGroup === "all"
    ? activeGroups
    : [targetGroup];

  for (const groupKey of groupsToProcess) {
    if (!activeGroups.includes(groupKey)) {
      console.log(`Skipping ${groupKey} — not active`);
      continue;
    }
    await processGroup(groupKey);
  }

  console.log("\nDone!");
}

main().catch(console.error);
