/**
 * Pipeline Runner — runs all stages in sequence
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts --group mammals    # Run pipeline for a specific group
 *   npx tsx scripts/run-pipeline.ts --group plants     # Plants (default if no group specified)
 *   npx tsx scripts/run-pipeline.ts --taxon 47375      # Legacy: single taxon ID
 *   npx tsx scripts/run-pipeline.ts --force             # Clear cache and re-run
 */

import path from "path";
import dotenv from "dotenv";
import { fetchSpecies } from "./01-fetch-species";
import { buildTaxonomy } from "./02-build-taxonomy";
import { fetchPhotos } from "./03-fetch-photos";
import { scorePhotos } from "./03b-score-photos";
import { generateContent } from "./04-generate-content";
import { assemble } from "./05-assemble";
import { classifyTraits } from "./06-classify-traits";
import { clearCache } from "./lib/cache";
import { resolveGroup, TAXON_GROUPS, type TaxonGroupConfig } from "./lib/groups";

// Load .env.local (override: true needed because shell may have empty ANTHROPIC_API_KEY)
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  // Resolve group from --group flag (or fall back to --taxon / default plants)
  const groupResult = resolveGroup(args);
  let groupKey: string;
  let groupConfig: TaxonGroupConfig;

  if (groupResult) {
    groupKey = groupResult.key;
    groupConfig = groupResult.config;
  } else {
    // Legacy --taxon support or default to plants
    const taxonIdx = args.indexOf("--taxon");
    if (taxonIdx !== -1) {
      const taxonId = parseInt(args[taxonIdx + 1]);
      // Find matching group or use plants with override
      const matchingGroup = Object.entries(TAXON_GROUPS).find(
        ([, cfg]) => cfg.taxonId === taxonId
      );
      if (matchingGroup) {
        groupKey = matchingGroup[0];
        groupConfig = matchingGroup[1];
      } else {
        // Custom taxon ID — run as plants with override
        groupKey = "plants";
        groupConfig = { ...TAXON_GROUPS.plants, taxonId };
      }
    } else {
      groupKey = "plants";
      groupConfig = TAXON_GROUPS.plants;
    }
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   New England Nature Explorer Pipeline   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();
  console.log(`Group: ${groupConfig.label} (${groupConfig.name})`);
  console.log(`Pipeline dir: data/pipeline/${groupKey}/`);
  console.log(`Content tier: ${groupConfig.contentTier}`);

  if (force) {
    console.log("Force mode: clearing all caches...");
    clearCache();
  }

  const startTime = Date.now();

  // Stage 1: Fetch species list
  const speciesList = await fetchSpecies(groupKey, groupConfig);

  // Stage 2: Build taxonomy tree
  const taxonomyTree = await buildTaxonomy(speciesList, groupKey, groupConfig);

  // Stage 3: Fetch photos
  await fetchPhotos(speciesList, groupKey);

  // Stage 3b: Score and rank photos with AI (requires ANTHROPIC_API_KEY)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "\n⚠ ANTHROPIC_API_KEY not set. Skipping photo scoring and content generation."
    );
    console.warn(
      "  Set it in .env.local to enable AI features."
    );
  } else {
    await scorePhotos(speciesList, groupKey);

    // Stage 4: Generate content (RAG-enhanced with Wikipedia + iNaturalist references)
    await generateContent(speciesList, taxonomyTree, groupKey, groupConfig);

    // Stage 6: Classify traits for browse pages
    await classifyTraits(speciesList, groupKey, groupConfig);
  }

  // Stage 5: Assemble final data (including browse index + seasonal guide)
  assemble(groupKey, groupConfig);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n Pipeline complete in ${elapsed}s`);
  console.log(`  Group: ${groupConfig.label}`);
  console.log(`  Species: ${speciesList.length}`);
  console.log(`  Data output: data/pipeline/${groupKey}/`);
}

main().catch((err) => {
  console.error("\nPipeline failed:", err);
  process.exit(1);
});
