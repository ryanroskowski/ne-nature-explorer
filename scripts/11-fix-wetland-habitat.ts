/**
 * Stage 11: Fix wetland habitat tagging using NWPL (National Wetland Plant List).
 *
 * - Adds "wetland" to habitatTypes for species that are OBL (obligate wetland)
 *   or FACW (facultative wetland) in the NWPL but missing from our data.
 * - Removes "wetland" from species that are UPL (upland only) in the NWPL.
 *
 * Usage: npx tsx scripts/11-fix-wetland-habitat.ts
 */

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline");
const CACHE_DIR = path.join(process.cwd(), ".cache");

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

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
}

function loadNWPL(): Map<string, string> {
  const filePath = path.join(CACHE_DIR, "NWPL_NCNE.xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  const map = new Map<string, string>();
  for (const row of rows) {
    const keys = Object.keys(row);
    const sciKey = keys.find((k) => k.startsWith("Scientific Name")) || "";
    const indKey = keys.find((k) => k.startsWith("NCNE")) || "NCNE";
    const sciName = (row[sciKey] || "").toString().trim().toLowerCase();
    const indicator = (row[indKey] || "").toString().trim();
    if (sciName && indicator) {
      map.set(sciName, indicator);
    }
  }
  return map;
}

async function main() {
  console.log("\n=== Stage 11: Fix Wetland Habitat Tags ===\n");

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-list.json"), "utf-8")
  );
  const traits: Record<string, TraitsEntry> = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-traits.json"), "utf-8")
  );
  const nwpl = loadNWPL();

  console.log(`  Species: ${speciesList.length}, NWPL entries: ${nwpl.size}`);

  let addedWetland = 0;
  let removedWetland = 0;
  let matched = 0;

  for (const sp of speciesList) {
    const t = traits[sp.taxonId.toString()];
    if (!t) continue;

    const indicator = nwpl.get(sp.scientificName.toLowerCase());
    if (!indicator) continue;
    matched++;

    const hasWetland = t.habitatTypes.includes("wetland");

    // OBL/FACW should have wetland
    if ((indicator === "OBL" || indicator === "FACW") && !hasWetland) {
      t.habitatTypes.push("wetland");
      addedWetland++;
    }

    // UPL should NOT have wetland
    if (indicator === "UPL" && hasWetland) {
      t.habitatTypes = t.habitatTypes.filter((h) => h !== "wetland");
      removedWetland++;
    }
  }

  // Write updated traits
  const traitsPath = path.join(PIPELINE_DIR, "species-traits.json");
  fs.writeFileSync(traitsPath, JSON.stringify(traits, null, 2));

  console.log(`  Matched: ${matched} species`);
  console.log(`  Added 'wetland': ${addedWetland} species (OBL/FACW)`);
  console.log(`  Removed 'wetland': ${removedWetland} species (UPL)`);
  console.log(`\n  Written updated species-traits.json`);
  console.log("  Run 'npx tsx scripts/05-assemble.ts' to regenerate browse data\n");
}

main().catch(console.error);
