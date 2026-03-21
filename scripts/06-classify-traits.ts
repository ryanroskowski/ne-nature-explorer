/**
 * Stage 6: Classify species traits using Claude Haiku
 *
 * Reads each species' generated content (idTips, description, habitat,
 * seasonality, taxonomy) and produces structured trait classifications
 * for the browse/filter pages.
 *
 * Features:
 * - Resume-safe: caches results per-species, skips already-classified
 * - Cost tracking: logs running cost after each species
 * - Constrained vocabulary: ensures consistent filterable tags
 * - Batch mode: classifies 5 species per API call for cost savings
 * - Multi-taxon: auto-detects group type and uses appropriate trait schema
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { getCached, setCache } from "./lib/cache";
import type {
  PipelineSpecies,
  GeneratedSpeciesContent,
  PipelineSpeciesTraits,
} from "./lib/types";
import type { TaxonGroupConfig } from "./lib/groups";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  override: true,
});

// Model and pricing config (Haiku 4.5)
const MODEL = "claude-haiku-4-5-20251001";
const HAIKU_INPUT_COST_PER_M = 1.0;
const HAIKU_OUTPUT_COST_PER_M = 5.0;

// Rate limiting
const REQUEST_INTERVAL_MS = 1500;

// Batch size for trait classification
const BATCH_SIZE = 5;

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
  const outputCost =
    (totalOutputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M;
  return `$${(inputCost + outputCost).toFixed(4)} (${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out)`;
}

// ============================================================
// Group-specific trait schemas
// ============================================================

type TraitSchemaType = "plant" | "animal" | "fungus" | "lichen";

function detectSchemaType(groupKey: string): TraitSchemaType {
  if (["birds", "mammals", "reptiles", "amphibians", "insects", "arachnids", "mollusks", "fish"].includes(groupKey)) {
    return "animal";
  }
  if (groupKey === "fungi") return "fungus";
  if (groupKey === "lichens") return "lichen";
  return "plant";
}

function buildTraitPromptForBatch(
  batch: { species: PipelineSpecies; content: GeneratedSpeciesContent | null }[],
  schemaType: TraitSchemaType
): string {
  const speciesDescriptions = batch.map((item, idx) => {
    const { species, content } = item;
    const idTipsSummary = content
      ? content.idTips
          .map((t) => `- ${t.label}${t.isPrimary ? " (primary)" : ""}: ${t.description}`)
          .join("\n")
      : "No ID tips available.";

    const seasonText = content
      ? `Spring: ${content.seasonality.spring}\nSummer: ${content.seasonality.summer}\nFall: ${content.seasonality.fall}\nWinter: ${content.seasonality.winter}`
      : "No seasonality data.";

    return `--- SPECIES ${idx + 1}: ${species.commonName} (${species.scientificName}) ---
FAMILY: ${species.familyCommonName || species.familyName || "Unknown"} (${species.familyName || "Unknown"})
ORDER: ${species.orderCommonName || species.orderName || "Unknown"}
CLASS: ${species.classCommonName || species.className || "Unknown"}
NATIVE STATUS: ${species.establishmentMeans || "unknown"}
DESCRIPTION: ${content?.description || "No description available."}
ID TIPS:\n${idTipsSummary}
HABITAT: ${content?.habitat || "No habitat data."}
SEASONALITY:\n${seasonText}`;
  }).join("\n\n");

  const schema = getTraitSchema(schemaType);

  return `Classify each of the following ${batch.length} species into structured traits for a browse/filter interface.

${speciesDescriptions}

${schema}

Respond with ONLY a JSON object where keys are the species scientific names and values are the trait objects:
{
  "${batch[0].species.scientificName}": { ... },
  ${batch.length > 1 ? `"${batch[1].species.scientificName}": { ... },` : ""}
  ...
}`;
}

function getTraitSchema(schemaType: TraitSchemaType): string {
  if (schemaType === "animal") {
    return `Classify into these EXACT categories. Use ONLY the allowed values listed:

1. bodyType: "bird" | "mammal" | "reptile" | "amphibian" | "insect" | "arachnid" | "mollusk" | "fish"

2. sizeClass: "tiny" | "small" | "medium" | "large" | "very-large"
   - tiny: < 2cm (insects, small spiders)
   - small: 2-15cm (small birds, frogs, butterflies)
   - medium: 15-60cm (songbirds, squirrels, snakes)
   - large: 60cm-1.5m (hawks, foxes, large snakes)
   - very-large: > 1.5m (deer, moose, eagles wingspan)

3. activityPattern: "diurnal" | "nocturnal" | "crepuscular" | "variable"

4. dietType: "herbivore" | "carnivore" | "omnivore" | "insectivore" | "nectivore" | "detritivore" | "parasitic" | "filter-feeder"

5. habitatTypes: Array. Use ONLY: "forest", "wetland", "meadow", "urban", "alpine", "coastal", "aquatic", "underground"

6. seasonalPresence: "year-round" | "breeding" | "winter" | "migratory-spring" | "migratory-fall"
   - "year-round" for resident species
   - "breeding" for species present mainly in breeding season
   - "winter" for winter visitors
   - "migratory-spring" / "migratory-fall" for passage migrants

7. isNative: true if native to New England, false if introduced/invasive

8. colorPattern: Array of primary colors. Use ONLY: "black", "white", "brown", "gray", "red", "orange", "yellow", "green", "blue", "iridescent", "spotted", "striped"

9. seasonalHighlights: For each season, list observable features.
   Use ONLY: "breeding-plumage", "song", "nesting", "migration", "hibernation", "active", "molting", "mating-display", "young-visible", "winter-coat", "tracks-visible", "calls"
   - Empty array if nothing notable for that season`;
  }

  if (schemaType === "fungus") {
    return `Classify into these EXACT categories. Use ONLY the allowed values listed:

1. fruitingBodyType: "cap-and-stem" | "bracket" | "cup" | "club" | "coral" | "puffball" | "jelly" | "crust" | "truffle" | "other"

2. capShape: "convex" | "flat" | "funnel" | "bell" | "knob" | "irregular" | "none"

3. sporeStructure: "gills" | "pores" | "teeth" | "smooth" | "ridges" | "enclosed" | "none"

4. colorPrimary: "white" | "brown" | "red" | "orange" | "yellow" | "purple" | "black" | "gray" | "green"

5. substrate: "soil" | "wood-living" | "wood-dead" | "leaf-litter" | "dung" | "other-fungi" | "moss"

6. habitatTypes: Array. Use ONLY: "forest", "wetland", "meadow", "roadside", "garden", "urban"

7. fruitingSeason: "spring" | "summer" | "fall" | "winter" | "year-round"

8. isEdible: "edible" | "inedible" | "poisonous" | "deadly" | "unknown"
   - ALWAYS err on the side of "unknown" or "inedible" if uncertain

9. isNative: true (most fungi are native; false only if clearly invasive)

10. seasonalHighlights: For each season, list observable features.
    Use ONLY: "fruiting", "mycelium-visible", "decomposing", "dormant"
    - Empty array if nothing notable`;
  }

  if (schemaType === "lichen") {
    return `Classify into these EXACT categories. Use ONLY the allowed values listed:

1. growthForm: "crustose" | "foliose" | "fruticose" | "squamulose" | "leprose"

2. colorPrimary: "gray" | "green" | "yellow" | "orange" | "brown" | "white" | "black"

3. substrate: "bark" | "rock" | "soil" | "wood" | "leaves" | "man-made"

4. habitatTypes: Array. Use ONLY: "forest", "wetland", "meadow", "alpine", "coastal", "urban"

5. isNative: true (almost all lichens are native)

6. seasonalHighlights: For each season, list observable features.
    Use ONLY: "colorful-wet", "dormant-dry", "apothecia-visible", "soredia-visible"
    - Empty array if nothing notable`;
  }

  // Plant schema (default)
  return `Classify into these EXACT categories. Use ONLY the allowed values listed:

1. growthForm: "tree" | "shrub" | "herb" | "vine" | "grass-sedge" | "fern" | "moss" | "aquatic"

2. leafType: "needles" | "broad-deciduous" | "broad-evergreen" | "fronds" | "blades" | "scales" | "none"

3. flowerColors: Array. Use ONLY: "white", "yellow", "orange", "pink", "red", "purple", "blue", "green"
   - Empty array [] for non-flowering plants

4. flowerShape: "composite" | "tubular" | "bell" | "pea-like" | "radial" | "irregular" | "catkin" | "umbel" | "spike" | "none"

5. fruitType: "cone" | "berry" | "nut-acorn" | "drupe" | "pod" | "capsule" | "winged-seed" | "achene" | "aggregate" | "spore" | "none"

6. habitatTypes: Array. Use ONLY: "forest", "wetland", "meadow", "roadside", "alpine", "coastal", "aquatic", "garden"

7. bloomPeriod: "early-spring" | "spring" | "late-spring" | "early-summer" | "summer" | "late-summer" | "fall" | null

8. isNative: true if native to New England, false if introduced

9. seasonalHighlights: For each season, list observable features.
   Use ONLY: "flowers", "new-leaves", "catkins", "fiddleheads", "pollen", "fruit", "berries", "seeds", "cones", "pods", "fall-color", "leaf-drop", "bark", "evergreen", "persistent-fruit", "buds", "silhouette", "winter-rosette"
   - Empty array if nothing notable`;
}

// ============================================================
// Validate and sanitize trait output
// ============================================================

function sanitizeTraits(raw: Record<string, unknown>, schemaType: TraitSchemaType): PipelineSpeciesTraits {
  const filterArray = (arr: unknown, validSet: Set<string>): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((v) => typeof v === "string" && validSet.has(v));
  };

  // For animals, fungi, and lichens: store traits as-is with the schema type marker
  // The frontend will need to handle polymorphic traits
  // For now, we store everything the same way — the raw traits object with a _schemaType field
  const result: PipelineSpeciesTraits = {
    ...(raw as any),
    _schemaType: schemaType,
    isNative: typeof raw.isNative === "boolean" ? raw.isNative : true,
    seasonalHighlights: {
      spring: filterArray(
        (raw.seasonalHighlights as Record<string, unknown>)?.spring,
        new Set(["flowers", "new-leaves", "catkins", "fiddleheads", "pollen",
          "fruit", "berries", "seeds", "cones", "pods",
          "fall-color", "leaf-drop", "bark", "evergreen", "persistent-fruit", "buds", "silhouette", "winter-rosette",
          "breeding-plumage", "song", "nesting", "migration", "hibernation", "active", "molting", "mating-display", "young-visible", "winter-coat", "tracks-visible", "calls",
          "fruiting", "mycelium-visible", "decomposing", "dormant",
          "colorful-wet", "dormant-dry", "apothecia-visible", "soredia-visible"])
      ),
      summer: filterArray(
        (raw.seasonalHighlights as Record<string, unknown>)?.summer,
        new Set(["flowers", "new-leaves", "catkins", "fiddleheads", "pollen",
          "fruit", "berries", "seeds", "cones", "pods",
          "fall-color", "leaf-drop", "bark", "evergreen", "persistent-fruit", "buds", "silhouette", "winter-rosette",
          "breeding-plumage", "song", "nesting", "migration", "hibernation", "active", "molting", "mating-display", "young-visible", "winter-coat", "tracks-visible", "calls",
          "fruiting", "mycelium-visible", "decomposing", "dormant",
          "colorful-wet", "dormant-dry", "apothecia-visible", "soredia-visible"])
      ),
      fall: filterArray(
        (raw.seasonalHighlights as Record<string, unknown>)?.fall,
        new Set(["flowers", "new-leaves", "catkins", "fiddleheads", "pollen",
          "fruit", "berries", "seeds", "cones", "pods",
          "fall-color", "leaf-drop", "bark", "evergreen", "persistent-fruit", "buds", "silhouette", "winter-rosette",
          "breeding-plumage", "song", "nesting", "migration", "hibernation", "active", "molting", "mating-display", "young-visible", "winter-coat", "tracks-visible", "calls",
          "fruiting", "mycelium-visible", "decomposing", "dormant",
          "colorful-wet", "dormant-dry", "apothecia-visible", "soredia-visible"])
      ),
      winter: filterArray(
        (raw.seasonalHighlights as Record<string, unknown>)?.winter,
        new Set(["flowers", "new-leaves", "catkins", "fiddleheads", "pollen",
          "fruit", "berries", "seeds", "cones", "pods",
          "fall-color", "leaf-drop", "bark", "evergreen", "persistent-fruit", "buds", "silhouette", "winter-rosette",
          "breeding-plumage", "song", "nesting", "migration", "hibernation", "active", "molting", "mating-display", "young-visible", "winter-coat", "tracks-visible", "calls",
          "fruiting", "mycelium-visible", "decomposing", "dormant",
          "colorful-wet", "dormant-dry", "apothecia-visible", "soredia-visible"])
      ),
    },
    // Ensure habitatTypes are validated
    habitatTypes: filterArray(raw.habitatTypes, new Set([
      "forest", "wetland", "meadow", "roadside", "alpine", "coastal", "aquatic", "garden", "urban", "underground",
    ])),
  };

  return result;
}

// ============================================================
// Main classification pipeline
// ============================================================

export async function classifyTraits(
  speciesList: PipelineSpecies[],
  groupKey: string = "plants",
  groupConfig?: TaxonGroupConfig
): Promise<void> {
  const OUTPUT_DIR = path.join(process.cwd(), "data", "pipeline", groupKey);
  const schemaType = detectSchemaType(groupKey);

  console.log("\n=== Stage 6: Classify Traits (Haiku Batch) ===");
  console.log(`  Model: ${MODEL}`);
  console.log(`  Schema: ${schemaType}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(
    `  Pricing: $${HAIKU_INPUT_COST_PER_M}/MTok in, $${HAIKU_OUTPUT_COST_PER_M}/MTok out`
  );

  const client = getClient();

  // Load species content from Stage 4
  const contentPath = path.join(OUTPUT_DIR, "species-content.json");
  const speciesContent: Record<string, GeneratedSpeciesContent> =
    fs.existsSync(contentPath)
      ? JSON.parse(fs.readFileSync(contentPath, "utf-8"))
      : {};

  const allTraits: Record<string, PipelineSpeciesTraits> = {};
  let classifiedCount = 0;
  let cachedCount = 0;

  // Collect uncached species for batching
  const uncachedItems: { species: PipelineSpecies; content: GeneratedSpeciesContent | null }[] = [];

  for (const species of speciesList) {
    const cacheKey = `traits_${species.taxonId}`;
    const cached = getCached<PipelineSpeciesTraits>("traits", cacheKey);

    if (cached) {
      allTraits[species.taxonId.toString()] = cached;
      cachedCount++;
      continue;
    }

    uncachedItems.push({
      species,
      content: speciesContent[species.taxonId.toString()] || null,
    });
  }

  console.log(`  ${cachedCount} cached, ${uncachedItems.length} to classify`);

  // Process in batches
  for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
    const batch = uncachedItems.slice(i, i + BATCH_SIZE);
    const batchNames = batch.map((b) => b.species.commonName).join(", ");

    console.log(
      `  [${i + 1}-${Math.min(i + BATCH_SIZE, uncachedItems.length)}/${uncachedItems.length}] ${batchNames}...`
    );

    // Rate limit
    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));

    const prompt = buildTraitPromptForBatch(batch, schemaType);

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: batch.length * 500,
        messages: [{ role: "user", content: prompt }],
      });

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

      const parsed = JSON.parse(cleaned);

      // Extract results for each species in the batch
      for (const item of batch) {
        const rawTraits = parsed[item.species.scientificName];
        if (rawTraits) {
          const traits = sanitizeTraits(rawTraits, schemaType);
          allTraits[item.species.taxonId.toString()] = traits;
          setCache("traits", `traits_${item.species.taxonId}`, traits);
          classifiedCount++;
        } else {
          // Try to find by partial match or use defaults
          console.warn(`    ⚠ No traits returned for ${item.species.scientificName}`);
          const defaults = getDefaults(item.species, schemaType);
          allTraits[item.species.taxonId.toString()] = defaults;
          setCache("traits", `traits_${item.species.taxonId}`, defaults);
          classifiedCount++;
        }
      }

      console.log(`    💰 ${getCostSoFar()}`);
    } catch (err) {
      const errMsg = (err as Error).message || String(err);
      console.warn(`    ⚠ Batch failed: ${errMsg}`);

      // Retry once on rate limits
      if (errMsg.includes("rate") || errMsg.includes("429") || errMsg.includes("overloaded")) {
        console.log(`    Waiting 30s and retrying...`);
        await new Promise((r) => setTimeout(r, 30_000));
        try {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: batch.length * 500,
            messages: [{ role: "user", content: prompt }],
          });
          if (response.usage) {
            totalInputTokens += response.usage.input_tokens;
            totalOutputTokens += response.usage.output_tokens;
          }
          const text = response.content[0].type === "text" ? response.content[0].text : "";
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          for (const item of batch) {
            const rawTraits = parsed[item.species.scientificName];
            const traits = rawTraits ? sanitizeTraits(rawTraits, schemaType) : getDefaults(item.species, schemaType);
            allTraits[item.species.taxonId.toString()] = traits;
            setCache("traits", `traits_${item.species.taxonId}`, traits);
            classifiedCount++;
          }
        } catch {
          console.warn(`    ⚠ Retry failed. Using defaults for batch.`);
          for (const item of batch) {
            const defaults = getDefaults(item.species, schemaType);
            allTraits[item.species.taxonId.toString()] = defaults;
            setCache("traits", `traits_${item.species.taxonId}`, defaults);
            classifiedCount++;
          }
        }
      } else {
        for (const item of batch) {
          const defaults = getDefaults(item.species, schemaType);
          allTraits[item.species.taxonId.toString()] = defaults;
          setCache("traits", `traits_${item.species.taxonId}`, defaults);
          classifiedCount++;
        }
      }
    }
  }

  // Write all traits
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, "species-traits.json");
  fs.writeFileSync(outputPath, JSON.stringify(allTraits, null, 2));

  console.log(
    `\nDone! Classified ${classifiedCount} species (${cachedCount} cached). 💰 Total: ${getCostSoFar()}`
  );
  console.log(`Output: ${outputPath}`);
}

// ============================================================
// Fallback defaults
// ============================================================

function getDefaults(species: PipelineSpecies, schemaType: TraitSchemaType): PipelineSpeciesTraits {
  const base = {
    _schemaType: schemaType,
    isNative: species.establishmentMeans !== "introduced",
    habitatTypes: ["forest"] as string[],
    seasonalHighlights: {
      spring: [] as string[],
      summer: [] as string[],
      fall: [] as string[],
      winter: [] as string[],
    },
  };

  if (schemaType === "animal") {
    const className = (species.className || "").toLowerCase();
    return {
      ...base,
      bodyType: className === "aves" ? "bird" : className === "mammalia" ? "mammal" : className === "insecta" ? "insect" : "mammal",
      sizeClass: "medium",
      activityPattern: "diurnal",
      dietType: "omnivore",
      seasonalPresence: "year-round",
      colorPattern: ["brown"],
    } as any;
  }

  if (schemaType === "fungus") {
    return {
      ...base,
      fruitingBodyType: "cap-and-stem",
      capShape: "convex",
      sporeStructure: "gills",
      colorPrimary: "brown",
      substrate: "soil",
      fruitingSeason: "fall",
      isEdible: "unknown",
    } as any;
  }

  if (schemaType === "lichen") {
    return {
      ...base,
      growthForm: "foliose",
      colorPrimary: "gray",
      substrate: "bark",
    } as any;
  }

  // Plant defaults
  return {
    ...base,
    growthForm: "herb",
    leafType: "broad-deciduous",
    flowerColors: ["white"],
    flowerShape: "radial",
    fruitType: "capsule",
    bloomPeriod: "summer",
  } as any;
}

// ============================================================
// Run directly
// ============================================================

if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const groupConfig = groupResult?.config || TAXON_GROUPS.plants;
  const outputDir = path.join(process.cwd(), "data", "pipeline", groupKey);

  const speciesPath = path.join(outputDir, "species-enriched.json");
  if (!fs.existsSync(speciesPath)) {
    console.error(`Error: Run stages 01-03 --group ${groupKey} first.`);
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );

  classifyTraits(speciesList, groupKey, groupConfig)
    .then(() => console.log("\nTrait classification complete."))
    .catch(console.error);
}
