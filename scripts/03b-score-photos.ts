/**
 * Stage 3b: Score and rank photos using Claude Vision
 *
 * Uses Claude Haiku 4.5 for cost-effective photo scoring (~$0.008/species).
 * Sequential mode with rate limiting for reliable processing.
 *
 * Features:
 * - Taxon-aware: requires specific photo categories per organism type
 * - Resume-safe: caches results per-species, skips already-scored species
 * - Cost tracking: logs running cost after each species
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { getCached, setCache } from "./lib/cache";
import type { PipelineSpecies, PipelinePhoto } from "./lib/types";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

// Model and pricing config (Haiku 4.5 standard pricing)
const SCORING_MODEL = "claude-haiku-4-5-20251001";
const HAIKU_INPUT_COST_PER_M = 1.0;
const HAIKU_OUTPUT_COST_PER_M = 5.0;

// Rate limiting: 1.5s between requests to stay well under limits
const REQUEST_INTERVAL_MS = 1500;

interface PhotoScore {
  photoId: number;
  score: number; // 1-10
  category: string;
  reasoning: string;
}

interface ScoredPhotos {
  scores: PhotoScore[];
  selected: number[]; // photo IDs in display order
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set. Add it to .env.local.");
  }
  return new Anthropic({ apiKey });
}

// ============================================================
// Cost tracking
// ============================================================

let totalInputTokens = 0;
let totalOutputTokens = 0;

function getCostSoFar(): string {
  const inputCost = (totalInputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M;
  const outputCost = (totalOutputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;
  return `$${(inputCost + outputCost).toFixed(4)} (${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out)`;
}

// ============================================================
// Taxon-aware photo requirements
// ============================================================

type TaxonPhotoType = "conifer" | "angiosperm" | "fern" | "fungus" | "bird" | "insect" | "lichen" | "mammal" | "reptile" | "amphibian" | "arachnid" | "mollusk" | "fish" | "general";

function detectPhotoTaxonType(species: PipelineSpecies): TaxonPhotoType {
  const order = (species.orderName || "").toLowerCase();
  const family = (species.familyName || "").toLowerCase();
  const className = (species.className || "").toLowerCase();
  const phylum = (species.phylumName || "").toLowerCase();

  // Plants
  if (order === "pinales" || family === "pinaceae" || family === "cupressaceae" || family === "taxaceae") {
    return "conifer";
  }
  if (className === "magnoliopsida" || className === "liliopsida") return "angiosperm";
  if (className === "polypodiopsida") return "fern";

  // Fungi & Lichens
  if (className.includes("agaricomycetes") || className.includes("ascomycet") || phylum === "basidiomycota" || phylum === "ascomycota") return "fungus";
  if (className === "lecanoromycetes" || order.includes("lecanor") || order.includes("peltig")) return "lichen";

  // Animals
  if (className === "aves") return "bird";
  if (className === "insecta") return "insect";
  if (className === "mammalia") return "mammal";
  if (className === "reptilia") return "reptile";
  if (className === "amphibia") return "amphibian";
  if (className === "arachnida") return "arachnid";
  if (phylum === "mollusca") return "mollusk";
  if (className === "actinopterygii") return "fish";

  return "general";
}

function getTaxonPhotoGuidance(type: TaxonPhotoType): string {
  switch (type) {
    case "conifer":
      return `
REQUIRED PHOTO VARIETY for conifers — your selection MUST try to include:
- At least 1 whole-plant/silhouette shot showing overall tree shape
- At least 1 foliage close-up (needles/scales showing arrangement)
- At least 1 reproductive structure (cones, berries for junipers)
- At least 1 bark detail
If any category has no suitable photos, note it and select the best available.`;

    case "angiosperm":
      return `
REQUIRED PHOTO VARIETY for flowering plants — your selection MUST try to include:
- At least 1 whole-plant shot showing growth habit
- At least 1 flower close-up (if available — note bloom period may mean no flower photos exist)
- At least 1 fruit/seed/nut photo (if available)
- At least 1 leaf detail showing shape, arrangement, and venation
- At least 1 bark detail (for trees/shrubs)
If any category has no suitable photos, note it and select the best available.`;

    case "fern":
      return `
REQUIRED PHOTO VARIETY for ferns — your selection MUST try to include:
- At least 1 whole frond shot
- At least 1 sori (spore-bearing) detail
- At least 1 growth habit/habitat shot
If any category has no suitable photos, note it and select the best available.`;

    case "fungus":
      return `
REQUIRED PHOTO VARIETY for fungi — your selection MUST try to include:
- At least 1 cap top view
- At least 1 gill/pore/underside view
- At least 1 showing stem and overall form
- At least 1 habitat/substrate context
If any category has no suitable photos, note it and select the best available.`;

    case "bird":
      return `
REQUIRED PHOTO VARIETY for birds — your selection MUST try to include:
- At least 1 full body shot showing overall shape and posture
- At least 1 showing plumage color/pattern details
- At least 1 showing the bill/head in detail
- At least 1 in-habitat shot (perched, foraging, or in flight)
If any category has no suitable photos, note it and select the best available.`;

    case "insect":
      return `
REQUIRED PHOTO VARIETY for insects — your selection MUST try to include:
- At least 1 dorsal (top-down) view showing wing pattern and body shape
- At least 1 lateral (side) view showing body profile
- At least 1 showing key ID features (antennae, wing venation, color pattern)
- At least 1 in-habitat or behavior shot (on flower, flying, etc.)
If any category has no suitable photos, note it and select the best available.`;

    case "mammal":
      return `
REQUIRED PHOTO VARIETY for mammals — your selection MUST try to include:
- At least 1 full body profile shot
- At least 1 showing face/head details
- At least 1 in-habitat or behavioral shot
- At least 1 showing distinctive features (tracks, markings, tail, ears)
If any category has no suitable photos, note it and select the best available.`;

    case "reptile":
      return `
REQUIRED PHOTO VARIETY for reptiles — your selection MUST try to include:
- At least 1 full body shot showing overall shape and pattern
- At least 1 head/face detail
- At least 1 showing scale pattern or color markings
- At least 1 in-habitat shot
If any category has no suitable photos, note it and select the best available.`;

    case "amphibian":
      return `
REQUIRED PHOTO VARIETY for amphibians — your selection MUST try to include:
- At least 1 full body shot (dorsal and/or lateral)
- At least 1 showing face/eye detail
- At least 1 showing skin texture and color pattern
- At least 1 in-habitat shot (on land, in water, on vegetation)
If any category has no suitable photos, note it and select the best available.`;

    case "lichen":
      return `
REQUIRED PHOTO VARIETY for lichens — your selection MUST try to include:
- At least 1 showing overall growth form (crustose/foliose/fruticose)
- At least 1 close-up of surface texture and color
- At least 1 showing reproductive structures (apothecia, soredia) if present
- At least 1 showing substrate context (bark, rock, soil)
If any category has no suitable photos, note it and select the best available.`;

    case "arachnid":
      return `
REQUIRED PHOTO VARIETY for arachnids — your selection MUST try to include:
- At least 1 dorsal view showing body shape and markings
- At least 1 showing eye arrangement or cephalothorax detail
- At least 1 in-habitat shot (on web, on vegetation, on ground)
If any category has no suitable photos, note it and select the best available.`;

    case "mollusk":
      return `
REQUIRED PHOTO VARIETY for mollusks — your selection MUST try to include:
- At least 1 showing shell shape/form (or body for slugs)
- At least 1 showing color and pattern detail
- At least 1 in-habitat shot
If any category has no suitable photos, note it and select the best available.`;

    case "fish":
      return `
REQUIRED PHOTO VARIETY for fish — your selection MUST try to include:
- At least 1 full lateral (side) view showing body shape
- At least 1 showing fin details and color pattern
- At least 1 showing head/mouth detail
If any category has no suitable photos, note it and select the best available.`;

    default:
      return `
Select photos with maximum variety of perspectives (whole organism, close-up details, habitat context).`;
  }
}

// ============================================================
// Photo scoring
// ============================================================

async function scorePhotosForSpecies(
  client: Anthropic,
  species: PipelineSpecies,
  photos: PipelinePhoto[]
): Promise<ScoredPhotos> {
  if (photos.length === 0) {
    return { scores: [], selected: [] };
  }

  const taxonType = detectPhotoTaxonType(species);
  const varietyGuidance = getTaxonPhotoGuidance(taxonType);

  // Build image content blocks
  const imageBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (let i = 0; i < photos.length; i++) {
    imageBlocks.push({
      type: "text",
      text: `Photo ${i + 1} (ID: ${photos[i].id}):`,
    });
    imageBlocks.push({
      type: "image",
      source: {
        type: "url",
        url: photos[i].mediumUrl,
      },
    });
  }

  const prompt: Anthropic.Messages.ContentBlockParam = {
    type: "text",
    text: `You are evaluating photos for a species page on a nature education website.

Species: ${species.commonName} (${species.scientificName})
Family: ${species.familyCommonName || species.familyName || "Unknown"}

Score each photo 1-10 based on:
- Does it clearly show this species? (not a blurry background, someone's hand, water, a different organism, an unusual specimen)
- Is it well-lit and in focus?
- Does it show something useful for identification?
- Would a beginner find this photo helpful for learning to identify this species in the field?

Disqualifying factors (score 1-3):
- Photo is mostly of something else (a hand, water, another species, a landscape with no clear specimen)
- Shows an unusual or atypical form of the species (deformed specimens, unusual formations, Christmas trees with decorations)
- Extremely blurry, dark, or overexposed
- Can't tell what species it is from the photo

For each photo, categorize it as one of: "whole-plant", "bark", "foliage", "reproductive" (cones/fruit/flowers/seeds), "habitat", "detail", "other"
${varietyGuidance}

Then select the best 6-8 photos (or fewer if not enough good ones — do NOT select photos scoring below 5), prioritizing:
1. Maximum variety of categories as described above
2. At least one clear whole-plant shot
3. Highest scores within each category

Respond with ONLY a JSON object:
{
  "scores": [
    { "photoId": <id>, "score": <1-10>, "category": "<category>", "reasoning": "<brief reason>" }
  ],
  "selected": [<photo IDs in recommended display order>]
}`,
  };

  const response = await client.messages.create({
    model: SCORING_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, prompt],
      },
    ],
  });

  // Track token usage
  if (response.usage) {
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as ScoredPhotos;
  } catch {
    console.error(`    Failed to parse scoring response, keeping original order`);
    return {
      scores: photos.map((p) => ({
        photoId: p.id,
        score: 5,
        category: "other",
        reasoning: "Parse error — default score",
      })),
      selected: photos.slice(0, 6).map((p) => p.id),
    };
  }
}

// ============================================================
// Reorder photos based on scoring results
// ============================================================

function reorderPhotos(photos: PipelinePhoto[], scored: ScoredPhotos): PipelinePhoto[] {
  const photoMap = new Map(photos.map((p) => [p.id, p]));
  const ordered: PipelinePhoto[] = [];

  for (const id of scored.selected) {
    const photo = photoMap.get(id);
    if (photo) ordered.push(photo);
  }

  for (const photo of photos) {
    if (!scored.selected.includes(photo.id)) {
      ordered.push(photo);
    }
  }

  return ordered;
}

// ============================================================
// Main scoring pipeline — Sequential Mode
// ============================================================

export async function scorePhotos(
  speciesList: PipelineSpecies[],
  groupKey: string = "plants"
): Promise<Map<number, PipelinePhoto[]>> {
  const OUTPUT_DIR = path.join(process.cwd(), "data", "pipeline", groupKey);

  console.log("\n=== Stage 3b: Score Photos with AI (Haiku Sequential) ===");
  console.log(`  Model: ${SCORING_MODEL}`);
  console.log(`  Pricing: $${HAIKU_INPUT_COST_PER_M}/MTok in, $${HAIKU_OUTPUT_COST_PER_M}/MTok out`);

  const client = getClient();

  // Load photos from Stage 3
  const photosPath = path.join(OUTPUT_DIR, "photos.json");
  if (!fs.existsSync(photosPath)) {
    throw new Error("photos.json not found. Run Stage 3 first.");
  }
  const photosData: Record<string, PipelinePhoto[]> = JSON.parse(
    fs.readFileSync(photosPath, "utf-8")
  );

  const scoredPhotosMap = new Map<number, PipelinePhoto[]>();
  let scoredCount = 0;
  let cachedCount = 0;

  for (let i = 0; i < speciesList.length; i++) {
    const species = speciesList[i];
    const photos = photosData[species.taxonId.toString()] || [];

    if (photos.length === 0) {
      console.log(
        `  [${i + 1}/${speciesList.length}] ${species.commonName} — no photos, skipping`
      );
      scoredPhotosMap.set(species.taxonId, []);
      continue;
    }

    // Check cache
    const cacheKey = `photo_scores_${species.taxonId}`;
    const cached = getCached<ScoredPhotos>("photo_scores", cacheKey);

    let scored: ScoredPhotos;
    if (cached) {
      scored = cached;
      cachedCount++;
      if (cachedCount % 200 === 0) {
        console.log(
          `  [${i + 1}/${speciesList.length}] ... ${cachedCount} cached so far`
        );
      }
    } else {
      console.log(
        `  [${i + 1}/${speciesList.length}] ${species.commonName} (${photos.length} photos)...`
      );

      // Rate limit
      await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));

      try {
        scored = await scorePhotosForSpecies(client, species, photos);
      } catch (err) {
        const errMsg = (err as Error).message || String(err);
        console.warn(`    ⚠ Scoring failed: ${errMsg}. Keeping original order.`);

        // For rate limits, wait and retry once
        if (errMsg.includes("rate") || errMsg.includes("429") || errMsg.includes("overloaded")) {
          console.log(`    Waiting 30s and retrying...`);
          await new Promise((r) => setTimeout(r, 30_000));
          try {
            scored = await scorePhotosForSpecies(client, species, photos);
          } catch (retryErr) {
            console.warn(`    ⚠ Retry failed: ${(retryErr as Error).message}. Using defaults.`);
            scored = {
              scores: photos.map((p) => ({
                photoId: p.id,
                score: 5,
                category: "other" as string,
                reasoning: "Scoring failed — default",
              })),
              selected: photos.slice(0, 6).map((p) => p.id),
            };
          }
        } else {
          scored = {
            scores: photos.map((p) => ({
              photoId: p.id,
              score: 5,
              category: "other" as string,
              reasoning: "Scoring failed — default",
            })),
            selected: photos.slice(0, 6).map((p) => p.id),
          };
        }
      }

      scoredCount++;
      setCache("photo_scores", cacheKey, scored);

      // Compact log: just selected count and cost
      console.log(
        `    ${scored.selected.length} selected | 💰 ${getCostSoFar()}`
      );
    }

    scoredPhotosMap.set(species.taxonId, reorderPhotos(photos, scored));
  }

  // Save scored & reordered photos back to photos.json
  const outputData: Record<string, PipelinePhoto[]> = {};
  for (const [taxonId, photos] of scoredPhotosMap) {
    outputData[taxonId.toString()] = photos;
  }

  fs.writeFileSync(photosPath, JSON.stringify(outputData, null, 2));
  console.log(
    `\nDone! Scored ${scoredCount} species (${cachedCount} cached). 💰 Total: ${getCostSoFar()}`
  );
  console.log(`Photos reordered in ${photosPath}`);

  return scoredPhotosMap;
}

// ============================================================
// Run directly
// ============================================================

if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  const speciesPath = path.join(outputDir, "species-enriched.json");
  if (!fs.existsSync(speciesPath)) {
    console.error(`Error: Run stages 01-03 --group ${groupKey} first.`);
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );

  scorePhotos(speciesList, groupKey)
    .then((result) => {
      console.log(`\nScored photos for ${result.size} species.`);
    })
    .catch(console.error);
}
