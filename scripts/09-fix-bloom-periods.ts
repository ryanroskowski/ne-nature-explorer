/**
 * Stage 9: Fix bloom periods using iNaturalist observation histogram data.
 *
 * The verification script (Stage 8) found that ~30% of bloom periods disagree
 * with iNaturalist observation histograms. However, most "errors" are actually
 * observation bias (fall foliage for trees, berry season for fruiting species).
 *
 * This script fixes only the clearly wrong cases — species where our bloom period
 * is significantly off and the histogram peak is NOT explained by observation bias.
 *
 * Usage: npx tsx scripts/09-fix-bloom-periods.ts
 */

import fs from "fs";
import path from "path";

const NE_PLACE_IDS = "2,17,41,49,8,47";
const INAT_RATE_LIMIT_MS = 1100;
const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline");

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
  observationCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Map month (1-12) to bloom period
function monthToBloomPeriod(month: number): string {
  if (month >= 3 && month <= 4) return "early-spring";
  if (month === 5) return "late-spring";
  if (month >= 6 && month <= 7) return "summer";
  if (month === 8) return "late-summer";
  if (month >= 9 && month <= 10) return "fall";
  return "none";
}

function areAdjacentPeriods(a: string, b: string): boolean {
  const order = ["early-spring", "late-spring", "spring", "summer", "late-summer", "fall"];
  const idxA = order.indexOf(a);
  const idxB = order.indexOf(b);
  if (idxA === -1 || idxB === -1) return false;
  return Math.abs(idxA - idxB) <= 1;
}

/**
 * Determine if a peak observation month is likely caused by observation bias
 * rather than actual bloom time.
 */
function isLikelyObservationBias(
  growthForm: string,
  peakMonth: number,
  ourBloomPeriod: string
): boolean {
  // Trees/shrubs with fall peaks: almost always foliage bias
  if ((growthForm === "tree" || growthForm === "shrub") && peakMonth >= 9) return true;
  // Vines with fall peaks: usually berry/fruit bias
  if (growthForm === "vine" && peakMonth >= 9) return true;
  // Species we say bloom in summer with fall peaks: fruit/seed observation bias
  if (peakMonth >= 9 && (ourBloomPeriod === "summer" || ourBloomPeriod === "late-summer")) return true;
  return false;
}

async function main() {
  console.log("\n=== Stage 9: Fix Bloom Periods ===");
  console.log("  Source: iNaturalist observation histograms for NE states\n");

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-list.json"), "utf-8")
  );
  const traits: Record<string, TraitsEntry> = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "species-traits.json"), "utf-8")
  );

  // Filter to flowering species with bloom periods, sorted by observation count
  const candidates = speciesList.filter((sp) => {
    const t = traits[sp.taxonId.toString()];
    return t && t.bloomPeriod && t.bloomPeriod !== "none" && t.flowerColors.length > 0;
  }).sort((a, b) => b.observationCount - a.observationCount);

  // Check top 500 most-observed
  const toCheck = candidates.slice(0, 500);
  console.log(`  Checking top ${toCheck.length} most-observed flowering species...\n`);

  let checked = 0;
  let fixed = 0;
  let skippedBias = 0;
  let skippedAdjacent = 0;
  let correct = 0;
  const fixes: Array<{
    taxonId: number;
    name: string;
    scientificName: string;
    oldPeriod: string;
    newPeriod: string;
    peakMonth: number;
  }> = [];

  for (let i = 0; i < toCheck.length; i++) {
    const sp = toCheck[i];
    const t = traits[sp.taxonId.toString()];
    if (!t || !t.bloomPeriod) continue;

    const url = `https://api.inaturalist.org/v1/observations/histogram?taxon_id=${sp.taxonId}&place_id=${NE_PLACE_IDS}&date_field=observed&interval=month_of_year`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        await sleep(INAT_RATE_LIMIT_MS);
        continue;
      }

      const data = await res.json();
      const months: Record<string, number> = data.results?.month_of_year || {};

      // Find peak month (March-October only)
      let peakMonth = 0;
      let peakCount = 0;
      for (let m = 3; m <= 10; m++) {
        const count = months[m.toString()] || 0;
        if (count > peakCount) {
          peakCount = count;
          peakMonth = m;
        }
      }

      if (peakMonth === 0 || peakCount < 5) {
        await sleep(INAT_RATE_LIMIT_MS);
        continue;
      }

      checked++;
      const expectedPeriod = monthToBloomPeriod(peakMonth);
      const ourPeriod = t.bloomPeriod;
      const normalizedOur = ourPeriod === "spring"
        ? (peakMonth <= 4 ? "early-spring" : "late-spring")
        : ourPeriod;

      if (normalizedOur === expectedPeriod) {
        correct++;
      } else if (areAdjacentPeriods(normalizedOur, expectedPeriod)) {
        skippedAdjacent++;
      } else if (isLikelyObservationBias(t.growthForm, peakMonth, ourPeriod)) {
        skippedBias++;
      } else {
        // Genuine fix needed
        fixed++;
        fixes.push({
          taxonId: sp.taxonId,
          name: sp.commonName,
          scientificName: sp.scientificName,
          oldPeriod: ourPeriod,
          newPeriod: expectedPeriod,
          peakMonth,
        });
        // Apply fix
        t.bloomPeriod = expectedPeriod;
      }
    } catch (err) {
      console.log(`  ERROR: ${sp.scientificName} — ${err}`);
    }

    if ((i + 1) % 50 === 0 || i === toCheck.length - 1) {
      console.log(`  ${i + 1}/${toCheck.length} — ${fixed} fixes so far`);
    }

    await sleep(INAT_RATE_LIMIT_MS);
  }

  // Write updated traits
  const traitsPath = path.join(PIPELINE_DIR, "species-traits.json");
  fs.writeFileSync(traitsPath, JSON.stringify(traits, null, 2));

  // Summary
  console.log("\n  === RESULTS ===");
  console.log(`  Checked: ${checked}`);
  console.log(`  Correct: ${correct}`);
  console.log(`  Adjacent (kept): ${skippedAdjacent}`);
  console.log(`  Observation bias (kept): ${skippedBias}`);
  console.log(`  Fixed: ${fixed}`);

  if (fixes.length > 0) {
    console.log("\n  Fixes applied:");
    fixes.forEach((f) => {
      const monthName = [
        "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ][f.peakMonth];
      console.log(
        `    ${f.name} (${f.scientificName}): ${f.oldPeriod} → ${f.newPeriod} (peak: ${monthName})`
      );
    });
  }

  console.log("\n  Written updated species-traits.json");
  console.log("  Run 'npx tsx scripts/05-assemble.ts' to regenerate browse data\n");
}

main().catch(console.error);
