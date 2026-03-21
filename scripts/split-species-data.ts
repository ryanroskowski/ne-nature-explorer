/**
 * One-time script to split the monolithic nature-areas-species.json (~77MB)
 * into a lightweight index + individual per-area JSON files.
 *
 * Output:
 *   data/nature-areas-species-index.json  (~500KB index for map filtering)
 *   public/area-species/[areaId].json     (full species data per area, fetched on demand)
 *
 * Usage: npx tsx scripts/split-species-data.ts
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const AREA_SPECIES_DIR = path.join(process.cwd(), "public", "area-species");

// Ensure output directory exists
if (!fs.existsSync(AREA_SPECIES_DIR)) {
  fs.mkdirSync(AREA_SPECIES_DIR, { recursive: true });
}

// Read the monolithic file
const inputPath = path.join(DATA_DIR, "nature-areas-species.json");
console.log(`Reading ${inputPath}...`);
const raw = fs.readFileSync(inputPath, "utf-8");
const data = JSON.parse(raw);
console.log(`Loaded ${Object.keys(data.areaSpecies).length} areas`);

// Build lightweight index and write per-area files
const speciesIndex: Record<
  string,
  { speciesFound: number; groupBreakdown: Record<string, number> }
> = {};

let written = 0;
for (const [areaId, areaData] of Object.entries(data.areaSpecies) as [string, any][]) {
  // Index entry — just counts for filtering
  speciesIndex[areaId] = {
    speciesFound: areaData.speciesFound,
    groupBreakdown: areaData.groupBreakdown || {},
  };

  // Full per-area file
  fs.writeFileSync(
    path.join(AREA_SPECIES_DIR, `${areaId}.json`),
    JSON.stringify(areaData),
    "utf-8"
  );
  written++;
  if (written % 500 === 0) {
    console.log(`  Written ${written} area files...`);
  }
}

// Write lightweight index
const indexOutput = {
  generatedAt: data.generatedAt,
  areaSpecies: speciesIndex,
};
const indexPath = path.join(DATA_DIR, "nature-areas-species-index.json");
fs.writeFileSync(indexPath, JSON.stringify(indexOutput), "utf-8");

const indexSize = (fs.statSync(indexPath).size / 1024).toFixed(0);
console.log(`\nDone!`);
console.log(`  ${written} per-area files written to public/area-species/`);
console.log(`  Index written to data/nature-areas-species-index.json (${indexSize} KB)`);
