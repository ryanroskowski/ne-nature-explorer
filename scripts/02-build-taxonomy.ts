/**
 * Stage 2: Build taxonomy tree from iNaturalist taxa API
 *
 * For each species from Stage 1, fetches full taxon details including
 * ancestor chain. Builds a nested tree structure from root → species.
 */

import fs from "fs";
import path from "path";
import { fetchTaxaBatch, fetchTaxonDetails } from "./lib/inaturalist";
import type { INatTaxon, PipelineSpecies } from "./lib/types";
import type { TaxonomyNode } from "../lib/types";
import type { TaxonGroupConfig } from "./lib/groups";

// Ranks we care about for the tree (skip intermediate ranks)
const DISPLAY_RANKS = new Set([
  "kingdom",
  "phylum",
  "subphylum",
  "class",
  "order",
  "family",
  "genus",
  "species",
]);

interface TaxonInfo {
  id: number;
  name: string;
  commonName: string;
  rank: string;
}

export async function buildTaxonomy(
  speciesList: PipelineSpecies[],
  groupKey: string,
  groupConfig: TaxonGroupConfig
): Promise<TaxonomyNode> {
  console.log("\n=== Stage 2: Build Taxonomy Tree ===");

  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  // Collect all unique ancestor IDs we need to fetch
  const allAncestorIds = new Set<number>();
  for (const species of speciesList) {
    for (const ancestorId of species.ancestorIds) {
      allAncestorIds.add(ancestorId);
    }
    allAncestorIds.add(species.taxonId);
  }

  console.log(
    `Need taxonomy info for ${allAncestorIds.size} unique taxon IDs...`
  );

  // Fetch all taxa details in batches
  const allIds = Array.from(allAncestorIds);
  const taxaMap = new Map<number, INatTaxon>();

  for (let i = 0; i < allIds.length; i += 30) {
    const batch = allIds.slice(i, i + 30);
    console.log(
      `  Fetching taxa batch ${Math.floor(i / 30) + 1}/${Math.ceil(allIds.length / 30)}...`
    );
    const taxa = await fetchTaxaBatch(batch);
    for (const t of taxa) {
      taxaMap.set(t.id, t);
    }
  }

  console.log(`Fetched ${taxaMap.size} taxa details.`);

  // Also enrich species list with family/genus info
  for (const species of speciesList) {
    const taxon = taxaMap.get(species.taxonId);
    if (!taxon) continue;

    // Walk ancestors to find family, genus, order, etc.
    for (const ancestorId of species.ancestorIds) {
      const ancestor = taxaMap.get(ancestorId);
      if (!ancestor) continue;

      switch (ancestor.rank) {
        case "family":
          species.familyName = ancestor.name;
          species.familyCommonName =
            ancestor.preferred_common_name || ancestor.name;
          break;
        case "genus":
          species.genusName = ancestor.name;
          species.genusCommonName =
            ancestor.preferred_common_name || ancestor.name;
          break;
        case "order":
          species.orderName = ancestor.name;
          species.orderCommonName =
            ancestor.preferred_common_name || ancestor.name;
          break;
        case "class":
          species.className = ancestor.name;
          species.classCommonName =
            ancestor.preferred_common_name || ancestor.name;
          break;
        case "phylum":
          species.phylumName = ancestor.name;
          species.phylumCommonName =
            ancestor.preferred_common_name || ancestor.name;
          break;
      }
    }
  }

  // Build the tree structure
  console.log("Building taxonomy tree...");
  const tree = buildTree(speciesList, taxaMap, groupConfig);

  // Save outputs
  fs.mkdirSync(outputDir, { recursive: true });

  const treePath = path.join(outputDir, "taxonomy-tree.json");
  fs.writeFileSync(treePath, JSON.stringify(tree, null, 2));
  console.log(`Saved taxonomy tree to ${treePath}`);

  // Save enriched species list
  const speciesPath = path.join(outputDir, "species-enriched.json");
  fs.writeFileSync(speciesPath, JSON.stringify(speciesList, null, 2));
  console.log(`Saved enriched species to ${speciesPath}`);

  return tree;
}

function buildTree(
  speciesList: PipelineSpecies[],
  taxaMap: Map<number, INatTaxon>,
  groupConfig: TaxonGroupConfig
): TaxonomyNode {
  // Root node: use group config for dynamic root
  const rootId = groupConfig.taxonId || 0;
  const root: TaxonomyNode = {
    id: rootId,
    name: groupConfig.name,
    commonName: groupConfig.label,
    rank: groupConfig.rank as TaxonomyNode["rank"],
    speciesCount: speciesList.length,
    children: [],
  };

  // Determine which ranks to skip (everything at or above the root rank)
  const rankHierarchy = ["kingdom", "phylum", "subphylum", "class", "order", "family", "genus", "species"];
  const rootRankIdx = rankHierarchy.indexOf(groupConfig.rank);

  // For each species, walk its ancestor chain and insert into tree
  for (const species of speciesList) {
    // Build the path from root to species using only display ranks
    const pathNodes: TaxonInfo[] = [];

    for (const ancestorId of species.ancestorIds) {
      const taxon = taxaMap.get(ancestorId);
      if (!taxon) continue;
      if (!DISPLAY_RANKS.has(taxon.rank)) continue;

      // Skip ranks at or above the root rank (they're the root or its ancestors)
      const ancestorRankIdx = rankHierarchy.indexOf(taxon.rank);
      if (ancestorRankIdx <= rootRankIdx) continue;

      // For composite groups (no taxonId), also skip the root
      if (taxon.id === rootId) continue;

      pathNodes.push({
        id: taxon.id,
        name: taxon.name,
        commonName: taxon.preferred_common_name || taxon.name,
        rank: taxon.rank,
      });
    }

    // Add the species itself
    pathNodes.push({
      id: species.taxonId,
      name: species.scientificName,
      commonName: species.commonName,
      rank: "species",
    });

    // Walk the path and insert nodes into the tree
    let currentNode = root;
    for (const pathNode of pathNodes) {
      let child = currentNode.children.find((c) => c.id === pathNode.id);
      if (!child) {
        child = {
          id: pathNode.id,
          name: pathNode.name,
          commonName: pathNode.commonName,
          rank: pathNode.rank as TaxonomyNode["rank"],
          speciesCount: 0,
          children: [],
          slug: slugify(pathNode.commonName || pathNode.name),
          representativePhotoUrl:
            pathNode.rank === "species"
              ? speciesList.find((s) => s.taxonId === pathNode.id)
                  ?.defaultPhotoUrl
              : undefined,
        };
        currentNode.children.push(child);
      }
      currentNode = child;
    }
  }

  // Compute species counts bottom-up
  computeSpeciesCounts(root);

  // Sort children at each level by species count (descending)
  sortTree(root);

  return root;
}

function computeSpeciesCounts(node: TaxonomyNode): number {
  if (node.children.length === 0) {
    node.speciesCount = node.rank === "species" ? 1 : 0;
    return node.speciesCount;
  }

  node.speciesCount = node.children.reduce(
    (sum, child) => sum + computeSpeciesCounts(child),
    0
  );
  return node.speciesCount;
}

function sortTree(node: TaxonomyNode): void {
  node.children.sort((a, b) => b.speciesCount - a.speciesCount);
  for (const child of node.children) {
    sortTree(child);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Run directly
if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const groupConfig = groupResult?.config || TAXON_GROUPS.plants;

  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);
  const speciesPath = path.join(outputDir, "species-list.json");
  if (!fs.existsSync(speciesPath)) {
    console.error(`Error: Run 01-fetch-species.ts --group ${groupKey} first.`);
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );

  buildTaxonomy(speciesList, groupKey, groupConfig)
    .then((tree) => {
      console.log(`\nDone! Tree has ${tree.speciesCount} species.`);
      printTree(tree, 0);
    })
    .catch(console.error);
}

function printTree(node: TaxonomyNode, depth: number): void {
  const indent = "  ".repeat(depth);
  console.log(
    `${indent}${node.commonName} (${node.name}) [${node.rank}] — ${node.speciesCount} species`
  );
  for (const child of node.children) {
    printTree(child, depth + 1);
  }
}
