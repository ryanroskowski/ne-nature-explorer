/**
 * Stage 10: Verify habitat types and flower colors.
 *
 * Checks:
 * 1. Wetland habitat — cross-reference our "wetland" habitat tag against the
 *    National Wetland Plant List (NWPL) indicator status for the Northeast region.
 *    Species tagged OBL or FACW should be in our "wetland" habitat; species tagged
 *    UPL or FACU probably should not.
 *
 * 2. Flower color consistency — flag species whose flower colors are unusual
 *    within their genus (statistical outlier check).
 *
 * Usage: npx tsx scripts/10-verify-habitat-colors.ts
 */

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline");
const CACHE_DIR = path.join(process.cwd(), ".cache");
const OUTPUT_DIR = path.join(process.cwd(), "data");

// ---------- Types ----------
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
  genusName?: string;
  familyName?: string;
  observationCount: number;
}

interface NWPLEntry {
  scientificName: string;
  indicator: string; // OBL, FACW, FAC, FACU, UPL
  commonName: string;
}

interface WetlandIssue {
  taxonId: number;
  scientificName: string;
  commonName: string;
  nwplIndicator: string;
  ourHabitats: string[];
  hasWetland: boolean;
  issue: string;
}

interface ColorIssue {
  taxonId: number;
  scientificName: string;
  commonName: string;
  genus: string;
  ourColors: string[];
  genusColors: string[];
  issue: string;
}

// ---------- Check 1: Wetland Habitat ----------
function loadNWPL(): Map<string, NWPLEntry> {
  const filePath = path.join(CACHE_DIR, "NWPL_NCNE.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  NWPL file not found at .cache/NWPL_NCNE.xlsx");
    console.log("  Download from: https://wetland-plants.usace.army.mil/static/reports/2022_NWPL_NCNE.xlsx");
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  const map = new Map<string, NWPLEntry>();
  for (const row of rows) {
    // Column names have trailing non-breaking spaces (\xa0) in the NWPL file
    // Use key matching to find the right columns
    const keys = Object.keys(row);
    const sciKey = keys.find((k) => k.startsWith("Scientific Name")) || "";
    const indKey = keys.find((k) => k.startsWith("NCNE")) || "NCNE";
    const nameKey = keys.find((k) => k.startsWith("Common Name")) || "";
    const sciName = (row[sciKey] || "").toString().trim();
    const indicator = (row[indKey] || "").toString().trim();
    const commonName = (row[nameKey] || "").toString().trim();
    if (sciName && indicator) {
      map.set(sciName.toLowerCase(), { scientificName: sciName, indicator, commonName });
    }
  }
  return map;
}

function checkWetlandHabitat(
  speciesList: PipelineSpecies[],
  traits: Record<string, TraitsEntry>,
  nwpl: Map<string, NWPLEntry>
): { issues: WetlandIssue[]; matched: number; missingWetland: number; falseWetland: number; correct: number } {
  console.log("\n--- Check 1: Wetland Habitat vs NWPL ---");
  console.log(`  NWPL entries: ${nwpl.size}`);

  let matched = 0;
  let missingWetland = 0;
  let falseWetland = 0;
  let correct = 0;
  const issues: WetlandIssue[] = [];

  for (const sp of speciesList) {
    const t = traits[sp.taxonId.toString()];
    if (!t) continue;

    const nwplEntry = nwpl.get(sp.scientificName.toLowerCase());
    if (!nwplEntry) continue;

    matched++;
    const hasWetland = t.habitatTypes.includes("wetland");
    const indicator = nwplEntry.indicator;

    // OBL (obligate wetland) or FACW (facultative wetland) — should have wetland habitat
    if ((indicator === "OBL" || indicator === "FACW") && !hasWetland) {
      missingWetland++;
      issues.push({
        taxonId: sp.taxonId,
        scientificName: sp.scientificName,
        commonName: sp.commonName,
        nwplIndicator: indicator,
        ourHabitats: t.habitatTypes,
        hasWetland,
        issue: `NWPL says ${indicator} (wetland obligate/facultative) but we don't tag it as wetland`,
      });
    }
    // UPL (upland) — should NOT have wetland habitat
    else if (indicator === "UPL" && hasWetland) {
      falseWetland++;
      issues.push({
        taxonId: sp.taxonId,
        scientificName: sp.scientificName,
        commonName: sp.commonName,
        nwplIndicator: indicator,
        ourHabitats: t.habitatTypes,
        hasWetland,
        issue: `NWPL says UPL (upland) but we incorrectly tag it as wetland`,
      });
    } else {
      correct++;
    }
  }

  console.log(`  Matched against NWPL: ${matched} species`);
  console.log(`  Correct: ${correct}`);
  console.log(`  Missing 'wetland' tag (OBL/FACW species): ${missingWetland}`);
  console.log(`  False 'wetland' tag (UPL species): ${falseWetland}`);

  return { issues, matched, missingWetland, falseWetland, correct };
}

// ---------- Check 2: Flower Color Consistency ----------
function checkFlowerColorConsistency(
  speciesList: PipelineSpecies[],
  traits: Record<string, TraitsEntry>
): { issues: ColorIssue[]; checked: number } {
  console.log("\n--- Check 2: Flower Color Genus Consistency ---");

  // Build genus → color frequency map
  const genusColors: Map<string, Map<string, number>> = new Map();
  const genusSpecies: Map<string, PipelineSpecies[]> = new Map();

  for (const sp of speciesList) {
    const t = traits[sp.taxonId.toString()];
    if (!t || t.flowerColors.length === 0) continue;

    const genus = sp.scientificName.split(" ")[0];
    if (!genusColors.has(genus)) {
      genusColors.set(genus, new Map());
      genusSpecies.set(genus, []);
    }
    genusSpecies.get(genus)!.push(sp);

    for (const color of t.flowerColors) {
      const colorMap = genusColors.get(genus)!;
      colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }
  }

  const issues: ColorIssue[] = [];
  let checked = 0;

  // Only check genera with 3+ species (enough for statistical comparison)
  for (const [genus, colorMap] of genusColors) {
    const species = genusSpecies.get(genus)!;
    if (species.length < 3) continue;

    // Find dominant colors (present in >50% of genus species)
    const dominantColors: string[] = [];
    for (const [color, count] of colorMap) {
      if (count / species.length >= 0.5) {
        dominantColors.push(color);
      }
    }

    // Flag species that have NO overlap with dominant genus colors
    for (const sp of species) {
      const t = traits[sp.taxonId.toString()]!;
      checked++;

      if (dominantColors.length === 0) continue; // No dominant color in this genus

      const hasOverlap = t.flowerColors.some((c) => dominantColors.includes(c));
      if (!hasOverlap) {
        // This species has completely different colors from the genus norm
        issues.push({
          taxonId: sp.taxonId,
          scientificName: sp.scientificName,
          commonName: sp.commonName,
          genus,
          ourColors: t.flowerColors,
          genusColors: dominantColors,
          issue: `Colors [${t.flowerColors.join(", ")}] don't overlap with genus-typical [${dominantColors.join(", ")}]`,
        });
      }
    }
  }

  console.log(`  Genera with 3+ species: ${[...genusColors].filter(([, , ]) => true).length}`);
  console.log(`  Species checked: ${checked}`);
  console.log(`  Color outliers found: ${issues.length}`);

  return { issues, checked };
}

// ---------- Main ----------
async function main() {
  console.log("\n========================================");
  console.log("  Stage 10: Habitat & Color Verification");
  console.log("========================================\n");

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-list.json"), "utf-8")
  );
  const traits: Record<string, TraitsEntry> = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-traits.json"), "utf-8")
  );

  console.log(`  Loaded ${speciesList.length} species, ${Object.keys(traits).length} trait records`);

  // Check 1: Wetland
  const nwpl = loadNWPL();
  const wetlandResult = checkWetlandHabitat(speciesList, traits, nwpl);

  // Check 2: Color consistency
  const colorResult = checkFlowerColorConsistency(speciesList, traits);

  // Summary
  console.log("\n\n========================================");
  console.log("  VERIFICATION SUMMARY");
  console.log("========================================\n");

  const wetlandAccuracy = wetlandResult.matched > 0
    ? ((wetlandResult.correct / wetlandResult.matched) * 100).toFixed(1)
    : "N/A";
  console.log(`  WETLAND HABITAT: ${wetlandAccuracy}% correct (${wetlandResult.matched} species matched against NWPL)`);
  console.log(`    - ${wetlandResult.missingWetland} missing 'wetland' tag (OBL/FACW species)`);
  console.log(`    - ${wetlandResult.falseWetland} false 'wetland' tag (UPL species)`);

  console.log(`\n  FLOWER COLORS: ${colorResult.issues.length} genus outliers out of ${colorResult.checked} checked`);

  // Print top issues
  if (wetlandResult.issues.length > 0) {
    console.log(`\n  --- Wetland Issues (first 30 of ${wetlandResult.issues.length}) ---`);
    // Show false wetland first (more actionable), then missing
    const sorted = [...wetlandResult.issues].sort((a, b) => {
      if (a.nwplIndicator === "UPL" && b.nwplIndicator !== "UPL") return -1;
      if (b.nwplIndicator === "UPL" && a.nwplIndicator !== "UPL") return 1;
      return 0;
    });
    sorted.slice(0, 30).forEach((issue) => {
      console.log(`  [${issue.nwplIndicator}] ${issue.commonName} (${issue.scientificName}): ${issue.issue}`);
    });
    if (wetlandResult.issues.length > 30) {
      console.log(`  ... and ${wetlandResult.issues.length - 30} more`);
    }
  }

  if (colorResult.issues.length > 0) {
    console.log(`\n  --- Color Outliers (first 20 of ${colorResult.issues.length}) ---`);
    colorResult.issues.slice(0, 20).forEach((issue) => {
      console.log(`  ${issue.commonName} (${issue.genus}): ${issue.issue}`);
    });
    if (colorResult.issues.length > 20) {
      console.log(`  ... and ${colorResult.issues.length - 20} more`);
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    wetlandCheck: {
      matched: wetlandResult.matched,
      correct: wetlandResult.correct,
      missingWetland: wetlandResult.missingWetland,
      falseWetland: wetlandResult.falseWetland,
      issues: wetlandResult.issues,
    },
    colorCheck: {
      checked: colorResult.checked,
      outliers: colorResult.issues.length,
      issues: colorResult.issues,
    },
  };

  const reportPath = path.join(OUTPUT_DIR, "habitat-color-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Full report written to: ${reportPath}`);
  console.log("  Done!\n");
}

main().catch(console.error);
