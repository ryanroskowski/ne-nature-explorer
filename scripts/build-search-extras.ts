/**
 * Builds supplementary search indexes used by the /search page:
 *
 *   - data/search-index-articles.json — contextual knowledge articles
 *   - data/search-index-areas.json — nature areas (slim: no geometry)
 *
 * Both are small, client-loadable JSON blobs used to surface "unified"
 * search results alongside species matches.
 *
 * Usage:  npx tsx scripts/build-search-extras.ts
 */

import fs from "fs";
import path from "path";
import type {
  ContextualArticle,
  NatureArea,
  NatureAreasData,
  ArticleBlock,
} from "../lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

interface ArticleSearchEntry {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  preview: string;
  relatedSpeciesSlugs: string[];
}

interface AreaSearchEntry {
  id: string;
  name: string;
  state: string;
  owner: string;
  ownerType: string;
  purpose: string;
  acreage: number;
  /** [lng, lat] for use in map deep-links */
  centroid: [number, number];
}

/**
 * Extract a plain-text preview from an article's blocks — used so the
 * search page can show a snippet and Fuse can match on body text.
 */
function extractPreview(content: ArticleBlock[]): string {
  const pieces: string[] = [];
  for (const block of content) {
    if (block.type === "intro" || block.type === "section" || block.type === "tip") {
      pieces.push(block.text);
      if (pieces.join(" ").length > 400) break;
    }
  }
  return pieces.join(" ").slice(0, 400);
}

function buildArticleIndex(): void {
  const articlePath = path.join(DATA_DIR, "contextual-knowledge.json");
  if (!fs.existsSync(articlePath)) {
    console.log("  No contextual-knowledge.json — skipping articles");
    return;
  }

  const articles: ContextualArticle[] = JSON.parse(
    fs.readFileSync(articlePath, "utf-8")
  );

  const entries: ArticleSearchEntry[] = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    icon: a.icon,
    preview: extractPreview(a.content),
    relatedSpeciesSlugs: a.relatedSpeciesSlugs || [],
  }));

  const outPath = path.join(DATA_DIR, "search-index-articles.json");
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2));
  console.log(`  Articles: ${entries.length} entries → search-index-articles.json`);
}

function buildAreasIndex(): void {
  const areasPath = path.join(DATA_DIR, "nature-areas.json");
  if (!fs.existsSync(areasPath)) {
    console.log("  No nature-areas.json — skipping areas");
    return;
  }

  const areasData: NatureAreasData = JSON.parse(
    fs.readFileSync(areasPath, "utf-8")
  );

  // Keep only searchable fields — strip geometry (huge) and filter out
  // tiny unnamed parcels that would clutter results. A ~20 acre threshold
  // plus requiring a real name removes thousands of uninteresting entries
  // while keeping all genuinely visitable areas.
  const filtered = areasData.areas.filter(
    (a) =>
      a.name &&
      !a.name.toLowerCase().startsWith("unnamed") &&
      a.acreage >= 20
  );

  const entries: AreaSearchEntry[] = filtered.map((a: NatureArea) => ({
    id: a.id,
    name: a.name,
    state: a.state,
    owner: a.owner,
    ownerType: a.ownerType,
    purpose: a.purpose,
    acreage: Math.round(a.acreage),
    centroid: a.centroid,
  }));

  // Sort by acreage descending so the biggest/most notable areas rank first
  // when Fuse scores are tied.
  entries.sort((a, b) => b.acreage - a.acreage);

  const outPath = path.join(DATA_DIR, "search-index-areas.json");
  fs.writeFileSync(outPath, JSON.stringify(entries));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(
    `  Areas: ${entries.length} entries (${sizeKb} KB) → search-index-areas.json`
  );
}

function main(): void {
  console.log("Building supplementary search indexes...\n");
  buildArticleIndex();
  buildAreasIndex();
  console.log("\nDone.");
}

main();
