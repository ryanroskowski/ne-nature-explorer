/**
 * Stage 4: Generate rich educational content via Claude API
 *
 * For each species, generates: name story, description, ID tips,
 * habitat, seasonality, fun fact, confusion notes, contextual knowledge,
 * and comparison hints.
 *
 * Also generates descriptions for taxonomy groups (families, genera).
 *
 * Supports tiered content generation for large groups (fungi/insects):
 * - Full content for top 75% by observation count
 * - Short content for species with <50 NE observations
 * - Skip content entirely for species with <5 NE observations
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateSpeciesContent, generateShortSpeciesContent, generateGroupContent, getContentCostSoFar } from "./lib/claude";
import { fetchReferenceData, formatReferenceForPrompt } from "./lib/reference-data";
import { getCached, setCache } from "./lib/cache";
import type { PipelineSpecies } from "./lib/types";
import type { GeneratedSpeciesContent, GeneratedGroupContent } from "./lib/types";
import type { TaxonomyNode } from "../lib/types";
import type { TaxonGroupConfig } from "./lib/groups";

// Load .env.local for API key (override: true for shell compatibility)
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

type ContentTier = "full" | "short" | "skip";

function getContentTierForSpecies(
  species: PipelineSpecies,
  groupConfig: TaxonGroupConfig,
  sortedSpecies: PipelineSpecies[]
): ContentTier {
  if (groupConfig.contentTier === "full") return "full";

  // Tiered mode (fungi/insects only)
  // Skip species with <5 NE observations
  if (species.observationCount < 5) return "skip";

  // Short content for species with <50 NE observations
  if (species.observationCount < 50) return "short";

  // Top 75% by observation count get full content
  const idx = sortedSpecies.findIndex((s) => s.taxonId === species.taxonId);
  const percentile = idx / sortedSpecies.length;
  if (percentile <= 0.75) return "full";

  return "short";
}

export async function generateContent(
  speciesList: PipelineSpecies[],
  taxonomyTree: TaxonomyNode,
  groupKey: string = "plants",
  groupConfig?: TaxonGroupConfig
): Promise<{
  speciesContent: Map<number, GeneratedSpeciesContent>;
  groupContent: Map<number, GeneratedGroupContent>;
}> {
  const OUTPUT_DIR = path.join(process.cwd(), "data", "pipeline", groupKey);

  console.log("\n=== Stage 4: Generate Content via Claude API ===");
  if (groupConfig?.contentTier === "tiered") {
    console.log("  Content tier: TIERED (full for top 75%, short for <50 obs, skip for <5 obs)");
  }

  // Sort species by observation count for tiering
  const sortedSpecies = [...speciesList].sort(
    (a, b) => b.observationCount - a.observationCount
  );

  // Generate species content
  const speciesContent = new Map<number, GeneratedSpeciesContent>();

  // Group species by genus for relatedSpecies context
  const genusSiblings = new Map<string, PipelineSpecies[]>();
  for (const s of speciesList) {
    const genus = s.genusName || "Unknown";
    if (!genusSiblings.has(genus)) genusSiblings.set(genus, []);
    genusSiblings.get(genus)!.push(s);
  }

  // Count tiers for logging
  let fullCount = 0;
  let shortCount = 0;
  let skipCount = 0;

  if (groupConfig?.contentTier === "tiered") {
    for (const s of speciesList) {
      const tier = getContentTierForSpecies(s, groupConfig, sortedSpecies);
      if (tier === "full") fullCount++;
      else if (tier === "short") shortCount++;
      else skipCount++;
    }
    console.log(`  Tier breakdown: ${fullCount} full, ${shortCount} short, ${skipCount} skip`);
  }

  console.log(`\nGenerating content for ${speciesList.length} species...`);

  for (let i = 0; i < speciesList.length; i++) {
    const species = speciesList[i];

    // Determine content tier
    const tier = groupConfig
      ? getContentTierForSpecies(species, groupConfig, sortedSpecies)
      : "full";

    if (tier === "skip") {
      if (i % 100 === 0) {
        console.log(`  [${i + 1}/${speciesList.length}] ... skipping low-observation species`);
      }
      continue;
    }

    console.log(
      `  [${i + 1}/${speciesList.length}] ${species.commonName}${tier === "short" ? " (short)" : ""}...`
    );

    // Check cache
    const cacheKey = `content_${species.taxonId}`;
    const cached = getCached<GeneratedSpeciesContent>("content", cacheKey);
    if (cached) {
      console.log("    (cached)");
      speciesContent.set(species.taxonId, cached);
      continue;
    }

    // Find related species in same genus
    const siblings = (genusSiblings.get(species.genusName || "") || [])
      .filter((s) => s.taxonId !== species.taxonId)
      .map((s) => ({
        commonName: s.commonName,
        scientificName: s.scientificName,
      }));

    try {
      let content: GeneratedSpeciesContent;

      if (tier === "short") {
        // Short content — minimal generation, no reference data fetch
        content = await generateShortSpeciesContent({
          commonName: species.commonName,
          scientificName: species.scientificName,
          familyName: species.familyName || "Unknown",
          familyCommonName: species.familyCommonName || "Unknown",
          genusName: species.genusName || "Unknown",
          genusCommonName: species.genusCommonName || "Unknown",
          orderName: species.orderName || "Unknown",
          observationCount: species.observationCount,
          establishmentMeans: species.establishmentMeans,
          className: species.className,
        });
      } else {
        // Full content — fetch reference data and generate everything
        const refData = await fetchReferenceData({
          scientificName: species.scientificName,
          taxonId: species.taxonId,
          wikipediaUrl: species.wikipediaUrl,
        });
        const referenceText = formatReferenceForPrompt(refData);

        content = await generateSpeciesContent({
          commonName: species.commonName,
          scientificName: species.scientificName,
          familyName: species.familyName || "Unknown",
          familyCommonName: species.familyCommonName || "Unknown",
          genusName: species.genusName || "Unknown",
          genusCommonName: species.genusCommonName || "Unknown",
          orderName: species.orderName || "Unknown",
          observationCount: species.observationCount,
          establishmentMeans: species.establishmentMeans,
          relatedSpecies: siblings,
          className: species.className,
          referenceText,
        });
      }

      speciesContent.set(species.taxonId, content);
      setCache("content", cacheKey, content);
      console.log(`    Done. 💰 Running cost: ${getContentCostSoFar()}`);
    } catch (err) {
      console.error(`    ERROR generating content: ${err}`);
      // Continue with other species
    }
  }

  // Generate group content for families and genera
  const groupContent = new Map<number, GeneratedGroupContent>();
  console.log("\nGenerating content for taxonomy groups...");

  await generateGroupContentRecursive(taxonomyTree, groupContent);

  // Save outputs
  const speciesContentObj: Record<string, GeneratedSpeciesContent> = {};
  for (const [id, content] of speciesContent) {
    speciesContentObj[id.toString()] = content;
  }

  const groupContentObj: Record<string, GeneratedGroupContent> = {};
  for (const [id, content] of groupContent) {
    groupContentObj[id.toString()] = content;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const speciesPath = path.join(OUTPUT_DIR, "species-content.json");
  fs.writeFileSync(speciesPath, JSON.stringify(speciesContentObj, null, 2));

  const groupPath = path.join(OUTPUT_DIR, "group-content.json");
  fs.writeFileSync(groupPath, JSON.stringify(groupContentObj, null, 2));

  console.log(`\nSaved species content to ${speciesPath}`);
  console.log(`Saved group content to ${groupPath}`);

  return { speciesContent, groupContent };
}

async function generateGroupContentRecursive(
  node: TaxonomyNode,
  contentMap: Map<number, GeneratedGroupContent>
): Promise<void> {
  // Generate content for family and genus ranks
  if (
    (node.rank === "family" || node.rank === "genus" || node.rank === "order") &&
    node.children.length > 0
  ) {
    const cacheKey = `group_${node.id}`;
    const cached = getCached<GeneratedGroupContent>("content", cacheKey);
    if (cached) {
      contentMap.set(node.id, cached);
    } else {
      console.log(`  ${node.rank}: ${node.commonName} (${node.name})...`);
      try {
        const content = await generateGroupContent({
          name: node.name,
          commonName: node.commonName,
          rank: node.rank,
          childNames: node.children.map(
            (c) => `${c.commonName} (${c.name})`
          ),
          speciesCount: node.speciesCount,
        });
        contentMap.set(node.id, content);
        setCache("content", cacheKey, content);
        console.log(`    💰 Running cost: ${getContentCostSoFar()}`);
      } catch (err) {
        console.error(`  ERROR: ${err}`);
      }
    }
  }

  // Recurse into children
  for (const child of node.children) {
    await generateGroupContentRecursive(child, contentMap);
  }
}

// Run directly
if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const groupConfig = groupResult?.config || TAXON_GROUPS.plants;
  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  const speciesPath = path.join(outputDir, "species-enriched.json");
  const treePath = path.join(outputDir, "taxonomy-tree.json");

  if (!fs.existsSync(speciesPath) || !fs.existsSync(treePath)) {
    console.error(`Error: Run stages 01 and 02 --group ${groupKey} first.`);
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );
  const tree: TaxonomyNode = JSON.parse(fs.readFileSync(treePath, "utf-8"));

  generateContent(speciesList, tree, groupKey, groupConfig)
    .then(({ speciesContent, groupContent }) => {
      console.log(
        `\nDone! Generated content for ${speciesContent.size} species and ${groupContent.size} groups.`
      );
    })
    .catch(console.error);
}
