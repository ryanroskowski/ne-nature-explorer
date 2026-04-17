/**
 * One-off: Rebuild per-group search-index-*.json files from existing species JSONs.
 *
 * Adds enriched fields (alternativeNames, abundanceTier, isNative, isInvasive,
 * thumbnailUrl) without re-running the full pipeline. Preserves existing
 * genus/family entries by reading them back from the current index on disk.
 *
 * Usage:  npx tsx scripts/rebuild-search-indexes.ts
 */

import fs from "fs";
import path from "path";
import type { SearchEntry, SpeciesData } from "../lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SPECIES_DIR = path.join(DATA_DIR, "species");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function rebuildForGroup(groupKey: string): void {
  const indexPath = path.join(DATA_DIR, `search-index-${groupKey}.json`);
  if (!fs.existsSync(indexPath)) {
    console.log(`  Skipping ${groupKey}: no existing index`);
    return;
  }

  const existing = readJson<SearchEntry[]>(indexPath);
  const speciesEntries: SearchEntry[] = [];
  const nonSpeciesEntries: SearchEntry[] = [];

  // Partition: we'll rebuild species entries fresh, but keep genus/family entries.
  for (const entry of existing) {
    if (entry.type === "species") {
      speciesEntries.push(entry);
    } else {
      nonSpeciesEntries.push(entry);
    }
  }

  // Rebuild species entries with enriched fields
  const rebuiltSpeciesEntries: SearchEntry[] = [];
  let enrichedCount = 0;
  let missingCount = 0;

  for (const entry of speciesEntries) {
    const speciesFile = path.join(SPECIES_DIR, `${entry.slug}.json`);
    if (!fs.existsSync(speciesFile)) {
      // No species JSON found — keep the old entry as-is
      rebuiltSpeciesEntries.push(entry);
      missingCount++;
      continue;
    }

    const species = readJson<SpeciesData>(speciesFile);
    rebuiltSpeciesEntries.push({
      slug: species.slug,
      commonName: species.commonName,
      scientificName: species.scientificName,
      family: species.family,
      familyCommonName: species.familyCommonName,
      genus: species.genus,
      group: groupKey,
      type: "species",
      ...(species.alternativeNames && species.alternativeNames.length > 0
        ? { alternativeNames: species.alternativeNames }
        : {}),
      abundanceTier: species.abundanceTier,
      ...(species.isNative !== undefined ? { isNative: species.isNative } : {}),
      ...(species.isInvasive !== undefined
        ? { isInvasive: species.isInvasive }
        : {}),
      ...(species.photos[0]?.mediumUrl
        ? { thumbnailUrl: species.photos[0].mediumUrl }
        : {}),
    });
    enrichedCount++;
  }

  const newIndex: SearchEntry[] = [...rebuiltSpeciesEntries, ...nonSpeciesEntries];
  fs.writeFileSync(indexPath, JSON.stringify(newIndex, null, 2));

  const altNameCount = rebuiltSpeciesEntries.filter(
    (e) => e.alternativeNames && e.alternativeNames.length > 0
  ).length;

  console.log(
    `  ${groupKey}: ${enrichedCount} enriched (${altNameCount} with alt names)` +
      (missingCount > 0 ? `, ${missingCount} kept as-is (species JSON missing)` : "") +
      `, ${nonSpeciesEntries.length} genus/family preserved`
  );
}

function main(): void {
  console.log("Rebuilding search indexes with enriched fields...\n");

  const indexFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("search-index-") && f.endsWith(".json"));

  const groups = indexFiles.map((f) =>
    f.replace("search-index-", "").replace(".json", "")
  );

  for (const group of groups) {
    rebuildForGroup(group);
  }

  console.log(`\nDone. Rebuilt ${groups.length} group indexes.`);
}

main();
