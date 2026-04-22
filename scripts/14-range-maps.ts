/**
 * Stage 14: Build per-species range maps.
 *
 * For each species in data/species/, produce a simplified GeoJSON polygon
 * at data/ranges/{slug}.json using the best available source:
 *
 *   - Plants → Little's Atlas if a match exists; otherwise iNat hull
 *   - All others → iNat observation concave hull
 *
 * Resume-safe: skips species that already have a range file (pass
 * --force to regenerate). Caches raw iNat observation points in
 * .cache/range-inat_*.json.
 *
 * Usage:
 *   npx tsx scripts/14-range-maps.ts                   # all species
 *   npx tsx scripts/14-range-maps.ts --group=plants    # one group
 *   npx tsx scripts/14-range-maps.ts --limit=20        # first 20
 *   npx tsx scripts/14-range-maps.ts --slug=eastern-white-pine  # one species
 *   npx tsx scripts/14-range-maps.ts --force           # redo everything
 */

import fs from "fs";
import path from "path";
import type { SpeciesData } from "../lib/types";
import {
  clipPointsToUSCanada,
  computeHull,
  fetchObservationPoints,
  finalizePolygon,
  getLittlesPolygon,
  shouldTryLittles,
  type RangeData,
} from "./lib/range-maps";

const DATA_DIR = path.join(process.cwd(), "data");
const SPECIES_DIR = path.join(DATA_DIR, "species");
const RANGES_DIR = path.join(DATA_DIR, "ranges");

interface Args {
  group?: string;
  slug?: string;
  limit?: number;
  force: boolean;
  outsideNaOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { force: false, outsideNaOnly: false };
  for (const arg of argv) {
    if (arg === "--force") out.force = true;
    else if (arg === "--outside-na-only") out.outsideNaOnly = true;
    else if (arg.startsWith("--group=")) out.group = arg.slice(8);
    else if (arg.startsWith("--slug=")) out.slug = arg.slice(7);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.slice(8));
  }
  return out;
}

/**
 * Return true if the existing range file is an inat-hull whose bbox
 * extends outside the NA clip box. Used by --outside-na-only to
 * regenerate only the ranges actually affected by the NA clip fix.
 */
function rangeExtendsOutsideNA(slug: string): boolean {
  const file = path.join(RANGES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const r = JSON.parse(fs.readFileSync(file, "utf-8")) as RangeData;
    if (r.source !== "inat-hull") return false;
    const [minLng, minLat, maxLng, maxLat] = r.bbox;
    // Matches NA_POINT_CLIP in lib/range-maps.ts
    return (
      minLng < -170 || maxLng > -50 || minLat < 5 || maxLat > 75
    );
  } catch {
    return false;
  }
}

function loadSpecies(slug: string): SpeciesData | null {
  const file = path.join(SPECIES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as SpeciesData;
  } catch {
    return null;
  }
}

function saveRange(slug: string, data: RangeData): void {
  fs.mkdirSync(RANGES_DIR, { recursive: true });
  const file = path.join(RANGES_DIR, `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
}

function rangeExists(slug: string): boolean {
  return fs.existsSync(path.join(RANGES_DIR, `${slug}.json`));
}

async function processSpecies(
  species: SpeciesData
): Promise<{ source: string; bytes: number } | null> {
  // 1. Try Little's for plants
  if (shouldTryLittles(species.group)) {
    const littles = getLittlesPolygon(species.scientificName);
    if (littles) {
      // Little's shapefiles are extremely detailed (~2 KB/polygon vertex
      // in GeoJSON form) — simplify aggressively. At a species-page map
      // size, 0.1° ≈ 11 km of simplification tolerance is invisible but
      // cuts file size ~20×.
      const { polygon, bbox } = finalizePolygon(littles, 0.1);
      const data: RangeData = {
        slug: species.slug,
        scientificName: species.scientificName,
        source: "littles",
        attribution:
          "Little, E. L., Jr. Atlas of United States Trees. USGS (digitized).",
        license: "Public domain (US federal work)",
        bbox,
        polygon,
      };
      saveRange(species.slug, data);
      return { source: "littles", bytes: JSON.stringify(data).length };
    }
  }

  // 2. iNat observation hull
  const allPoints = await fetchObservationPoints(species.taxonId, 500);
  if (allPoints.length < 4) return null;

  // Clip to US + Canada land. Without this, global hulls slice across
  // oceans and coastal hulls cross the Gulf of Mexico. See
  // clipPointsToUSCanada for the full rationale.
  const points = clipPointsToUSCanada(allPoints);
  if (points.length < 4) return null;

  const hull = computeHull(points, 2.5);
  if (!hull) return null;

  const { polygon, bbox } = finalizePolygon(hull, 0.05);
  const data: RangeData = {
    slug: species.slug,
    scientificName: species.scientificName,
    source: "inat-hull",
    attribution: "iNaturalist observation data (concave hull)",
    license: "iNaturalist observations — CC0/CC-BY/CC-BY-NC per record",
    bbox,
    observationCount: points.length,
    polygon,
  };
  saveRange(species.slug, data);
  return { source: "inat-hull", bytes: JSON.stringify(data).length };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Enumerate candidate slugs
  let slugs: string[];
  if (args.slug) {
    slugs = [args.slug];
  } else {
    slugs = fs
      .readdirSync(SPECIES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort();
  }

  // Optional group filter — load species file to check group
  const startedAt = Date.now();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const sourceCounts: Record<string, number> = {};
  const totalBudget = args.limit ?? Infinity;

  console.log(`\n=== Stage 14: Range Maps ===`);
  console.log(`Candidates: ${slugs.length}${args.group ? ` (filter group=${args.group})` : ""}`);

  for (let i = 0; i < slugs.length; i++) {
    if (processed >= totalBudget) break;
    const slug = slugs[i];

    // --outside-na-only: only touch inat-hull ranges whose bbox extends
    // beyond the NA clip box. These are the ones broken by the old
    // globally-hulled behavior. Implies --force for the ones we pick.
    if (args.outsideNaOnly) {
      if (!rangeExtendsOutsideNA(slug)) {
        skipped++;
        continue;
      }
      // fall through — reprocess
    } else if (!args.force && rangeExists(slug)) {
      skipped++;
      continue;
    }

    const species = loadSpecies(slug);
    if (!species) {
      failed++;
      continue;
    }

    if (args.group && species.group !== args.group) continue;

    const label = `[${i + 1}/${slugs.length}] ${species.commonName} (${species.scientificName})`;
    process.stdout.write(`  ${label}... `);
    try {
      const result = await processSpecies(species);
      if (result) {
        sourceCounts[result.source] = (sourceCounts[result.source] ?? 0) + 1;
        console.log(`✓ ${result.source} (${(result.bytes / 1024).toFixed(1)} KB)`);
        processed++;
      } else {
        // No usable data for this species. If we're regenerating an
        // existing range (force or outside-na-only), delete the stale
        // file — otherwise it would keep serving the old (wrong) map.
        const staleFile = path.join(RANGES_DIR, `${slug}.json`);
        if ((args.force || args.outsideNaOnly) && fs.existsSync(staleFile)) {
          fs.unlinkSync(staleFile);
          console.log(`✗ no data (removed stale file)`);
        } else {
          console.log(`✗ no data`);
        }
        failed++;
      }
    } catch (err) {
      console.log(`✗ error: ${(err as Error).message}`);
      failed++;
    }
  }

  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Done in ${secs}s ===`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (already had range): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  for (const [src, n] of Object.entries(sourceCounts)) {
    console.log(`    ${src}: ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
