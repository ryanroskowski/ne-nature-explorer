/**
 * Regenerate AI-generated content without re-fetching from iNaturalist.
 *
 * Useful when you've updated the prompts in claude.ts or want to
 * re-run with a newer model. Clears only the content and photo-score
 * caches, then re-runs stages 3b, 4, and 5.
 *
 * Usage:
 *   npx tsx scripts/regenerate.ts                    # Re-generate content + re-score photos
 *   npx tsx scripts/regenerate.ts --content-only      # Re-generate content only (keep photo scores)
 *   npx tsx scripts/regenerate.ts --photos-only       # Re-score photos only (keep content)
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { scorePhotos } from "./03b-score-photos";
import { generateContent } from "./04-generate-content";
import { assemble } from "./05-assemble";
import { clearCache } from "./lib/cache";
import type { PipelineSpecies } from "./lib/types";
import type { TaxonomyNode } from "../lib/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline");

function clearCacheCategory(category: string): number {
  // Cache uses flat structure: .cache/{namespace}_{hash}.json
  // Use the clearCache utility which handles this correctly
  const CACHE_DIR = path.join(process.cwd(), ".cache");
  if (!fs.existsSync(CACHE_DIR)) return 0;

  const files = fs.readdirSync(CACHE_DIR).filter((f) =>
    f.startsWith(`${category}_`)
  );
  for (const f of files) {
    fs.unlinkSync(path.join(CACHE_DIR, f));
  }
  return files.length;
}

async function main() {
  const args = process.argv.slice(2);
  const contentOnly = args.includes("--content-only");
  const photosOnly = args.includes("--photos-only");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set in .env.local");
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Regenerate AI Content                  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();

  // Load existing pipeline data
  const speciesPath = path.join(PIPELINE_DIR, "species-enriched.json");
  const treePath = path.join(PIPELINE_DIR, "taxonomy-tree.json");

  if (!fs.existsSync(speciesPath) || !fs.existsSync(treePath)) {
    console.error(
      "Error: Pipeline data not found. Run the full pipeline first."
    );
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );
  const tree: TaxonomyNode = JSON.parse(fs.readFileSync(treePath, "utf-8"));

  console.log(`Found ${speciesList.length} species in pipeline data.\n`);

  const startTime = Date.now();

  // Clear relevant caches
  if (!contentOnly) {
    const cleared = clearCacheCategory("photo_scores");
    console.log(`Cleared ${cleared} photo score cache entries.`);
  }

  if (!photosOnly) {
    const cleared = clearCacheCategory("content");
    console.log(`Cleared ${cleared} content cache entries.`);
  }

  console.log();

  // Re-score photos
  if (!contentOnly) {
    await scorePhotos(speciesList);
  }

  // Re-generate content
  if (!photosOnly) {
    await generateContent(speciesList, tree);
  }

  // Re-assemble
  assemble();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nRegeneration complete in ${elapsed}s`);
}

main().catch((err) => {
  console.error("\nRegeneration failed:", err);
  process.exit(1);
});
