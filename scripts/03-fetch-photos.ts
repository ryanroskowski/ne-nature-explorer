/**
 * Stage 3: Fetch CC-licensed photos for each species
 *
 * Fetches photos from multiple sources (most-voted, recent, curated taxon photos)
 * and combines them into a diverse pool for AI scoring in Stage 3b.
 */

import fs from "fs";
import path from "path";
import { fetchSpeciesPhotosWithFallback } from "./lib/inaturalist";
import type { PipelineSpecies, PipelinePhoto } from "./lib/types";

export async function fetchPhotos(
  speciesList: PipelineSpecies[],
  groupKey: string = "plants"
): Promise<Map<number, PipelinePhoto[]>> {
  const OUTPUT_DIR = path.join(process.cwd(), "data", "pipeline", groupKey);
  console.log("\n=== Stage 3: Fetch Photos ===");
  console.log(`Fetching photos for ${speciesList.length} species...`);
  console.log(`  (Using multi-source strategy: voted + recent + curated)`);

  const photosMap = new Map<number, PipelinePhoto[]>();

  for (let i = 0; i < speciesList.length; i++) {
    const species = speciesList[i];
    console.log(
      `  [${i + 1}/${speciesList.length}] ${species.commonName} (${species.scientificName})...`
    );

    const observations = await fetchSpeciesPhotosWithFallback(species.taxonId, 12);

    const photos: PipelinePhoto[] = [];
    const seenPhotoIds = new Set<number>();

    for (const obs of observations) {
      if (!obs.photos) continue;

      for (const photo of obs.photos) {
        // Deduplicate by photo ID
        if (seenPhotoIds.has(photo.id)) continue;
        seenPhotoIds.add(photo.id);

        // Build proper URLs from the photo URL
        // iNaturalist photo URLs end with /square.jpg or similar
        // We want medium and large versions
        const baseUrl = photo.url || "";
        const mediumUrl = baseUrl.replace(/\/square\./, "/medium.");
        const largeUrl = baseUrl.replace(/\/square\./, "/large.");

        photos.push({
          id: photo.id,
          url: baseUrl,
          mediumUrl,
          largeUrl,
          attribution: photo.attribution || `Photo ${photo.id}`,
          licenseCode: photo.license_code || "cc-by-nc",
          observationId: Math.abs(obs.id), // taxon photos use negative IDs
          observerName: obs.user?.name || obs.user?.login || "Unknown",
        });
      }
    }

    // Keep a larger pool (up to 16) for AI scoring to choose from
    const selectedPhotos = photos.slice(0, 16);
    photosMap.set(species.taxonId, selectedPhotos);

    console.log(`    Found ${photos.length} photos, kept ${selectedPhotos.length} for scoring`);
  }

  // Save output
  const outputData: Record<string, PipelinePhoto[]> = {};
  for (const [taxonId, photos] of photosMap) {
    outputData[taxonId.toString()] = photos;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, "photos.json");
  console.log(`Output dir: ${OUTPUT_DIR}`);
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\nSaved photos to ${outputPath}`);

  return photosMap;
}

// Run directly
if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  const speciesPath = path.join(outputDir, "species-enriched.json");
  if (!fs.existsSync(speciesPath)) {
    console.error(`Error: Run 01 and 02 --group ${groupKey} first.`);
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );

  fetchPhotos(speciesList, groupKey)
    .then((photosMap) => {
      console.log(`\nDone! Fetched photos for ${photosMap.size} species.`);
    })
    .catch(console.error);
}
