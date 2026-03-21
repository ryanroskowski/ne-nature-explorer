/**
 * Stage 7: Fix native/introduced status using iNaturalist checklist data.
 *
 * The AI-based classification (Stage 6) is unreliable for isNative —
 * it over-classifies species as introduced (~52% vs the real ~35%).
 *
 * This script fetches the authoritative native species list from iNaturalist's
 * observations/species_counts endpoint for all 6 NE states, then cross-references
 * against our species list to set isNative accurately.
 *
 * Usage: npx tsx scripts/07-fix-native-status.ts
 */

import fs from "fs";
import path from "path";

// iNaturalist place IDs for New England states
const NE_PLACE_IDS = "2,17,41,49,8,47"; // MA, ME, NH, CT, RI, VT
const PLANTAE_TAXON_ID = 47126;
const PER_PAGE = 500;
const RATE_LIMIT_MS = 1200; // slightly above 1 req/sec

interface SpeciesCount {
  count: number;
  taxon: {
    id: number;
    name: string;
    preferred_common_name?: string;
  };
}

interface SpeciesCountsResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: SpeciesCount[];
}

async function fetchPage(page: number): Promise<SpeciesCountsResponse> {
  const url = `https://api.inaturalist.org/v1/observations/species_counts?place_id=${NE_PLACE_IDS}&taxon_id=${PLANTAE_TAXON_ID}&native=true&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllNativeTaxonIds(): Promise<Set<number>> {
  const nativeIds = new Set<number>();

  // First page to get total
  console.log("  Fetching native species list from iNaturalist...");
  const first = await fetchPage(1);
  const totalResults = first.total_results;
  const totalPages = Math.ceil(totalResults / PER_PAGE);
  console.log(`  Total native plant species in NE: ${totalResults} (${totalPages} pages)`);

  // Process first page
  for (const r of first.results) {
    nativeIds.add(r.taxon.id);
  }
  console.log(`  Page 1/${totalPages} — ${nativeIds.size} IDs so far`);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(RATE_LIMIT_MS);
    const data = await fetchPage(page);
    for (const r of data.results) {
      nativeIds.add(r.taxon.id);
    }
    console.log(`  Page ${page}/${totalPages} — ${nativeIds.size} IDs so far`);
  }

  return nativeIds;
}

interface TraitsEntry {
  growthForm: string;
  leafType: string;
  flowerColors: string[];
  flowerShape: string;
  fruitType: string;
  habitatTypes: string[];
  bloomPeriod: string | null;
  isNative: boolean;
  seasonalHighlights: Record<string, string[]>;
}

async function main() {
  console.log("\n=== Stage 7: Fix Native/Introduced Status ===");
  console.log("  Source: iNaturalist observation checklists for NE states\n");

  // 1. Fetch native species from iNaturalist
  const nativeIds = await fetchAllNativeTaxonIds();
  console.log(`\n  Total unique native taxon IDs: ${nativeIds.size}`);

  // 2. Load current traits
  const traitsPath = path.join(process.cwd(), "data", "pipeline", "species-traits.json");
  const traits: Record<string, TraitsEntry> = JSON.parse(
    fs.readFileSync(traitsPath, "utf-8")
  );

  // 3. Update isNative based on iNaturalist data
  let changed = 0;
  let nativeCount = 0;
  let introCount = 0;
  const changes: string[] = [];

  for (const [taxonId, entry] of Object.entries(traits)) {
    const id = parseInt(taxonId);
    const wasNative = entry.isNative;
    const isNative = nativeIds.has(id);
    entry.isNative = isNative;

    if (isNative) nativeCount++;
    else introCount++;

    if (wasNative !== isNative) {
      changed++;
      if (changed <= 20) {
        changes.push(
          `  ${wasNative ? "native→INTRO" : "intro→NATIVE"}: taxon ${taxonId}`
        );
      }
    }
  }

  console.log(`\n  Updated: ${changed} species changed`);
  console.log(`  Native: ${nativeCount} (${Math.round((nativeCount / Object.keys(traits).length) * 100)}%)`);
  console.log(`  Introduced: ${introCount} (${Math.round((introCount / Object.keys(traits).length) * 100)}%)`);

  if (changes.length > 0) {
    console.log(`\n  Sample changes (first ${Math.min(20, changes.length)}):`);
    changes.forEach((c) => console.log(c));
    if (changed > 20) console.log(`  ... and ${changed - 20} more`);
  }

  // 4. Write updated traits
  fs.writeFileSync(traitsPath, JSON.stringify(traits, null, 2));
  console.log(`\n  Written updated species-traits.json`);
  console.log("  Run 'npx tsx scripts/05-assemble.ts' to regenerate browse data\n");
}

main().catch(console.error);
