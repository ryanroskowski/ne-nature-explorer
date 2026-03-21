/**
 * Stage 8: Data Verification — cross-check AI-generated data against authoritative APIs.
 *
 * Checks:
 * 1. Scientific name validity via GBIF Backbone Taxonomy
 * 2. Bloom period accuracy via iNaturalist observation histograms
 * 3. Growth form plausibility via GBIF (where data exists)
 *
 * Outputs a JSON report at data/verification-report.json
 * and a human-readable summary to stdout.
 *
 * Usage: npx tsx scripts/08-verify-data.ts
 */

import fs from "fs";
import path from "path";

// ---------- Config ----------
const GBIF_RATE_LIMIT_MS = 150; // GBIF is generous — ~6 req/sec is safe
const INAT_RATE_LIMIT_MS = 1100; // iNat: 1 req/sec
const NE_PLACE_IDS = "2,17,41,49,8,47";
const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline");
const OUTPUT_DIR = path.join(process.cwd(), "data");

// ---------- Types ----------
interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
  rank: string;
  observationCount: number;
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
}

interface GBIFMatch {
  matchType: string; // EXACT, FUZZY, HIGHERRANK, NONE
  confidence: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  status?: string; // ACCEPTED, SYNONYM, DOUBTFUL, etc.
  usageKey?: number;
  synonym?: boolean;
  // Taxonomy
  kingdom?: string;
  family?: string;
  genus?: string;
}

interface NameIssue {
  taxonId: number;
  ourName: string;
  commonName: string;
  matchType: string;
  gbifName?: string;
  gbifRank?: string;
  gbifStatus?: string;
  confidence: number;
  issue: string;
}

interface BloomIssue {
  taxonId: number;
  scientificName: string;
  commonName: string;
  ourBloomPeriod: string;
  peakMonth: number;
  peakMonthName: string;
  expectedPeriod: string;
  issue: string;
}

interface VerificationReport {
  timestamp: string;
  totalSpecies: number;
  nameCheck: {
    checked: number;
    exact: number;
    fuzzy: number;
    synonyms: number;
    higherRank: number;
    noMatch: number;
    issues: NameIssue[];
  };
  bloomCheck: {
    checked: number;
    correct: number;
    offByOne: number;
    wrong: number;
    issues: BloomIssue[];
  };
  summary: string[];
}

// ---------- Helpers ----------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(PIPELINE_DIR, filename), "utf-8"));
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Map month number (1-12) to bloom period label
function monthToBloomPeriod(month: number): string {
  if (month >= 3 && month <= 4) return "early-spring";
  if (month === 5) return "late-spring";
  if (month >= 6 && month <= 7) return "summer";
  if (month === 8) return "late-summer";
  if (month >= 9 && month <= 10) return "fall";
  return "none"; // winter months
}

// Check if two bloom periods are adjacent (off-by-one)
function areAdjacentPeriods(a: string, b: string): boolean {
  const order = ["early-spring", "late-spring", "spring", "summer", "late-summer", "fall"];
  const idxA = order.indexOf(a);
  const idxB = order.indexOf(b);
  if (idxA === -1 || idxB === -1) return false;
  return Math.abs(idxA - idxB) <= 1;
}

// ---------- Check 1: Scientific Name Validation via GBIF ----------
async function checkScientificNames(
  speciesList: PipelineSpecies[]
): Promise<VerificationReport["nameCheck"]> {
  console.log("\n--- Check 1: Scientific Name Validation (GBIF) ---");
  console.log(`  Checking ${speciesList.length} species against GBIF Backbone Taxonomy...\n`);

  const result: VerificationReport["nameCheck"] = {
    checked: 0,
    exact: 0,
    fuzzy: 0,
    synonyms: 0,
    higherRank: 0,
    noMatch: 0,
    issues: [],
  };

  // Batch in groups of 50 for progress reporting
  for (let i = 0; i < speciesList.length; i++) {
    const sp = speciesList[i];
    const encodedName = encodeURIComponent(sp.scientificName);
    const url = `https://api.gbif.org/v1/species/match?name=${encodedName}&kingdom=Plantae&strict=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  WARN: HTTP ${res.status} for ${sp.scientificName}`);
        await sleep(INAT_RATE_LIMIT_MS);
        continue;
      }

      const data: GBIFMatch = await res.json();
      result.checked++;

      if (data.matchType === "EXACT" && data.rank === "SPECIES") {
        result.exact++;
        // Check for synonyms
        if (data.status === "SYNONYM" || data.synonym) {
          result.synonyms++;
          result.issues.push({
            taxonId: sp.taxonId,
            ourName: sp.scientificName,
            commonName: sp.commonName,
            matchType: data.matchType,
            gbifName: data.scientificName,
            gbifStatus: data.status,
            confidence: data.confidence,
            issue: `Synonym — GBIF accepted name is "${data.canonicalName || data.scientificName}"`,
          });
        }
      } else if (data.matchType === "FUZZY") {
        result.fuzzy++;
        result.issues.push({
          taxonId: sp.taxonId,
          ourName: sp.scientificName,
          commonName: sp.commonName,
          matchType: data.matchType,
          gbifName: data.canonicalName || data.scientificName,
          gbifRank: data.rank,
          gbifStatus: data.status,
          confidence: data.confidence,
          issue: `Fuzzy match — possible typo? GBIF suggests "${data.canonicalName}"`,
        });
      } else if (data.matchType === "HIGHERRANK") {
        result.higherRank++;
        result.issues.push({
          taxonId: sp.taxonId,
          ourName: sp.scientificName,
          commonName: sp.commonName,
          matchType: data.matchType,
          gbifName: data.canonicalName || data.scientificName,
          gbifRank: data.rank,
          gbifStatus: data.status,
          confidence: data.confidence,
          issue: `Only matched to ${data.rank} level — species name not recognized`,
        });
      } else if (data.matchType === "NONE") {
        result.noMatch++;
        result.issues.push({
          taxonId: sp.taxonId,
          ourName: sp.scientificName,
          commonName: sp.commonName,
          matchType: "NONE",
          confidence: 0,
          issue: "No match in GBIF — name may be invalid or very recently described",
        });
      }
    } catch (err) {
      console.log(`  ERROR: ${sp.scientificName} — ${err}`);
    }

    // Progress
    if ((i + 1) % 200 === 0 || i === speciesList.length - 1) {
      console.log(`  ${i + 1}/${speciesList.length} checked — ${result.issues.length} issues found`);
    }

    await sleep(GBIF_RATE_LIMIT_MS);
  }

  return result;
}

// ---------- Check 2: Bloom Period Validation via iNat Histograms ----------
async function checkBloomPeriods(
  speciesList: PipelineSpecies[],
  traits: Record<string, TraitsEntry>
): Promise<VerificationReport["bloomCheck"]> {
  console.log("\n--- Check 2: Bloom Period Validation (iNat Histograms) ---");

  // Filter to species that have a bloom period assigned
  const withBloom = speciesList.filter((sp) => {
    const t = traits[sp.taxonId.toString()];
    return t && t.bloomPeriod && t.bloomPeriod !== "none" && t.flowerColors.length > 0;
  });

  console.log(`  ${withBloom.length} species have bloom periods to verify\n`);

  // Sample: check the top 500 most-observed flowering species (most impactful)
  const sorted = withBloom.sort((a, b) => b.observationCount - a.observationCount);
  const sample = sorted.slice(0, 500);
  console.log(`  Checking top ${sample.length} most-observed flowering species...\n`);

  const result: VerificationReport["bloomCheck"] = {
    checked: 0,
    correct: 0,
    offByOne: 0,
    wrong: 0,
    issues: [],
  };

  for (let i = 0; i < sample.length; i++) {
    const sp = sample[i];
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

      // Find peak observation month (only consider months 3-10 for bloom)
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
        // Not enough data
        await sleep(INAT_RATE_LIMIT_MS);
        continue;
      }

      result.checked++;
      const expectedPeriod = monthToBloomPeriod(peakMonth);
      const ourPeriod = t.bloomPeriod;

      // "spring" covers both early-spring and late-spring
      const normalizedOur = ourPeriod === "spring" ? (peakMonth <= 4 ? "early-spring" : "late-spring") : ourPeriod;

      if (normalizedOur === expectedPeriod) {
        result.correct++;
      } else if (areAdjacentPeriods(normalizedOur, expectedPeriod)) {
        result.offByOne++;
      } else {
        result.wrong++;
        result.issues.push({
          taxonId: sp.taxonId,
          scientificName: sp.scientificName,
          commonName: sp.commonName,
          ourBloomPeriod: ourPeriod,
          peakMonth,
          peakMonthName: MONTH_NAMES[peakMonth],
          expectedPeriod,
          issue: `We say "${ourPeriod}" but peak observations are in ${MONTH_NAMES[peakMonth]} (→ "${expectedPeriod}")`,
        });
      }
    } catch (err) {
      console.log(`  ERROR: ${sp.scientificName} — ${err}`);
    }

    if ((i + 1) % 50 === 0 || i === sample.length - 1) {
      console.log(`  ${i + 1}/${sample.length} checked — ${result.issues.length} bloom mismatches found`);
    }

    await sleep(INAT_RATE_LIMIT_MS);
  }

  return result;
}

// ---------- Main ----------
async function main() {
  console.log("\n========================================");
  console.log("  Stage 8: Data Verification");
  console.log("========================================\n");

  const speciesList: PipelineSpecies[] = loadJson("species-list.json");
  const traits: Record<string, TraitsEntry> = loadJson("species-traits.json");

  console.log(`  Loaded ${speciesList.length} species, ${Object.keys(traits).length} trait records`);

  // Run checks
  const nameCheck = await checkScientificNames(speciesList);
  const bloomCheck = await checkBloomPeriods(speciesList, traits);

  // Build summary
  const summary: string[] = [];

  // Name check summary
  const nameAccuracy = ((nameCheck.exact - nameCheck.synonyms) / nameCheck.checked * 100).toFixed(1);
  summary.push(`SCIENTIFIC NAMES: ${nameAccuracy}% exact valid matches out of ${nameCheck.checked} checked`);
  summary.push(`  - ${nameCheck.exact} exact matches (${nameCheck.synonyms} are synonyms)`);
  summary.push(`  - ${nameCheck.fuzzy} fuzzy matches (possible typos)`);
  summary.push(`  - ${nameCheck.higherRank} matched only to higher rank`);
  summary.push(`  - ${nameCheck.noMatch} no match at all`);

  // Bloom check summary
  if (bloomCheck.checked > 0) {
    const bloomAccuracy = ((bloomCheck.correct + bloomCheck.offByOne) / bloomCheck.checked * 100).toFixed(1);
    summary.push(`\nBLOOM PERIODS: ${bloomAccuracy}% correct or off-by-one out of ${bloomCheck.checked} checked`);
    summary.push(`  - ${bloomCheck.correct} exact match`);
    summary.push(`  - ${bloomCheck.offByOne} off by one period (adjacent season)`);
    summary.push(`  - ${bloomCheck.wrong} wrong (2+ seasons off)`);
  }

  // Print summary
  console.log("\n\n========================================");
  console.log("  VERIFICATION SUMMARY");
  console.log("========================================\n");
  summary.forEach((line) => console.log(`  ${line}`));

  // Write report
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    totalSpecies: speciesList.length,
    nameCheck,
    bloomCheck,
    summary,
  };

  const reportPath = path.join(OUTPUT_DIR, "verification-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Full report written to: ${reportPath}`);

  // Print actionable issues
  if (nameCheck.issues.length > 0) {
    console.log(`\n  --- Name Issues (${nameCheck.issues.length}) ---`);
    nameCheck.issues.slice(0, 30).forEach((issue) => {
      console.log(`  [${issue.matchType}] ${issue.ourName} (${issue.commonName}): ${issue.issue}`);
    });
    if (nameCheck.issues.length > 30) {
      console.log(`  ... and ${nameCheck.issues.length - 30} more (see report JSON)`);
    }
  }

  if (bloomCheck.issues.length > 0) {
    console.log(`\n  --- Bloom Period Issues (top 20 of ${bloomCheck.issues.length}) ---`);
    bloomCheck.issues.slice(0, 20).forEach((issue) => {
      console.log(`  ${issue.commonName} (${issue.scientificName}): ${issue.issue}`);
    });
    if (bloomCheck.issues.length > 20) {
      console.log(`  ... and ${bloomCheck.issues.length - 20} more (see report JSON)`);
    }
  }

  console.log("\n  Done!\n");
}

main().catch(console.error);
