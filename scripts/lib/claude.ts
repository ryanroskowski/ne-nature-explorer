import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedSpeciesContent, GeneratedGroupContent } from "./types";

let client: Anthropic | null = null;

// ============================================================
// Cost tracking
// ============================================================
const SONNET_INPUT_COST_PER_M = 3.0;
const SONNET_OUTPUT_COST_PER_M = 15.0;

let totalInputTokens = 0;
let totalOutputTokens = 0;

export function getContentCostSoFar(): string {
  const inputCost = (totalInputTokens / 1_000_000) * SONNET_INPUT_COST_PER_M;
  const outputCost = (totalOutputTokens / 1_000_000) * SONNET_OUTPUT_COST_PER_M;
  return `$${(inputCost + outputCost).toFixed(4)} (${totalInputTokens} in / ${totalOutputTokens} out)`;
}

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not set. Add it to .env.local or set as environment variable."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// ============================================================
// Taxon-type detection and prompt customization
// ============================================================

type TaxonType =
  | "conifer"
  | "angiosperm"
  | "fern"
  | "moss"
  | "fungus"
  | "bird"
  | "insect"
  | "lichen"
  | "mammal"
  | "reptile"
  | "amphibian"
  | "arachnid"
  | "mollusk"
  | "fish"
  | "general-plant";

/**
 * Detect the broad taxon type from order/family/class names
 * to customize the content generation prompt.
 */
function detectTaxonType(params: {
  orderName: string;
  familyName: string;
  className?: string;
  iconicTaxon?: string;
}): TaxonType {
  const order = params.orderName.toLowerCase();
  const family = params.familyName.toLowerCase();
  const className = (params.className || "").toLowerCase();
  const iconic = (params.iconicTaxon || "").toLowerCase();

  // Fungi
  if (iconic === "fungi" || className.includes("agaricomycetes") || className.includes("ascomycet")) {
    return "fungus";
  }

  // Birds
  if (iconic === "aves" || iconic === "birds") return "bird";

  // Insects
  if (iconic === "insecta" || iconic === "insects") return "insect";

  // Lichens (technically fungi but ecologically distinct)
  if (iconic === "lichens" || order.includes("lecanor") || order.includes("peltigeral")) {
    return "lichen";
  }

  // Animals
  if (className === "mammalia") return "mammal";
  if (className === "reptilia") return "reptile";
  if (className === "amphibia") return "amphibian";
  if (className === "arachnida") return "arachnid";
  if (className.includes("mollusca") || iconic === "mollusca") return "mollusk";
  if (className === "actinopterygii") return "fish";

  // Conifers / Gymnosperms
  if (
    order === "pinales" ||
    order === "cupressales" ||
    className === "pinopsida" ||
    family === "pinaceae" ||
    family === "cupressaceae" ||
    family === "taxaceae"
  ) {
    return "conifer";
  }

  // Ferns
  if (
    className === "polypodiopsida" ||
    order === "polypodiales" ||
    order === "osmundales" ||
    order === "ophioglossales"
  ) {
    return "fern";
  }

  // Mosses
  if (className === "bryopsida" || iconic === "bryophyta") {
    return "moss";
  }

  // Flowering plants (angiosperms) — default for most plants
  if (
    className === "magnoliopsida" ||
    className === "liliopsida" ||
    iconic === "plantae"
  ) {
    return "angiosperm";
  }

  return "general-plant";
}

/**
 * Get taxon-specific prompt additions for ID tips and content.
 * These guide the AI to focus on the right features for each group.
 */
function getTaxonTypeGuidance(type: TaxonType): string {
  switch (type) {
    case "conifer":
      return `
TAXON-SPECIFIC GUIDANCE (Conifer/Gymnosperm):
- For idTips: Focus on needle arrangement (singles, pairs, bundles of 3 or 5), needle shape (flat vs. square vs. round), cone shape and size, bark patterns, overall silhouette/growth form, and smell when needles are crushed.
- For seasonality: Conifers are evergreen (except larch) — focus on cone development timing, new growth "candles" in spring, pollen release, cone maturation. Winter is a great time to ID conifers when deciduous trees are bare.
- Label suggestions for idTips: "Needles", "Cones", "Bark", "Silhouette", "Smell", "Twigs"`;

    case "angiosperm":
      return `
TAXON-SPECIFIC GUIDANCE (Flowering Plant/Angiosperm):
- For idTips: Focus on flower structure (petal count, color, symmetry), leaf shape and arrangement (opposite vs. alternate), fruit/seed type (berry, drupe, samara, nut, capsule), bark (if a tree/shrub), and overall growth habit.
- For seasonality: Emphasize bloom period, fruit ripening, fall color, leaf emergence timing. Many spring ephemerals bloom before canopy closes — note if this applies. Mention pollinators if notable.
- Label suggestions for idTips: "Flowers", "Leaves", "Fruit/Seeds", "Bark", "Growth Habit", "Buds"
- If deciduous, note what makes it identifiable in winter (buds, bark, persistent fruit, branching pattern).`;

    case "fern":
      return `
TAXON-SPECIFIC GUIDANCE (Fern):
- For idTips: Focus on frond shape (once/twice/thrice-divided), sori pattern (dots, lines, marginal), stipe (stem) characteristics, fiddlehead appearance, and growth habit (clumping vs. spreading).
- For seasonality: Fiddlehead emergence in spring, spore production timing, deciduous vs. evergreen fronds, winter-persistent species.
- Label suggestions for idTips: "Fronds", "Sori", "Stipe", "Fiddleheads", "Growth Form", "Habitat"`;

    case "fungus":
      return `
TAXON-SPECIFIC GUIDANCE (Fungus):
- For idTips: Focus on cap shape and color, gill/pore/tooth structure, stem features (ring, volva, texture), spore print color, bruising reactions, and smell. ALWAYS include a safety note about edibility — never encourage eating wild mushrooms without expert confirmation.
- For seasonality: Peak fruiting season, substrate type (wood, soil, dung), mycelial relationship (mycorrhizal, saprophytic, parasitic). Many fungi fruit after rain — mention moisture dependence.
- Label suggestions for idTips: "Cap", "Gills/Pores", "Stem", "Spore Print", "Smell", "Bruising"
- IMPORTANT: Always note if this species has dangerous look-alikes.`;

    case "bird":
      return `
TAXON-SPECIFIC GUIDANCE (Bird):
- For idTips: Focus on plumage colors and patterns, size relative to common birds, bill shape, song/call description (phonetic if possible), flight pattern, and typical behavior/posture.
- For seasonality: Migration timing (resident vs. breeding vs. winter visitor), breeding plumage vs. non-breeding, song periods, nesting season, fall/winter flock behavior.
- Label suggestions for idTips: "Plumage", "Song/Call", "Bill", "Flight", "Size", "Behavior"`;

    case "insect":
      return `
TAXON-SPECIFIC GUIDANCE (Insect):
- For idTips: Focus on wing pattern/color, body shape, antenna type, size, distinctive behaviors, host plants, and life stage differences (larva vs. adult).
- For seasonality: Flight period, larval host plants, overwintering strategy, generation count (univoltine vs. multivoltine), peak activity times.
- Label suggestions for idTips: "Wings", "Body", "Antennae", "Behavior", "Host Plants", "Size"`;

    case "lichen":
      return `
TAXON-SPECIFIC GUIDANCE (Lichen):
- For idTips: Focus on growth form (crustose, foliose, fruticose), color (wet vs. dry), substrate preference, reproductive structures (apothecia, soredia, isidia), and chemical spot tests if common.
- For seasonality: Lichens are visible year-round but may look different wet vs. dry. Note color changes with moisture. They grow very slowly — old specimens may be very large.
- Label suggestions for idTips: "Growth Form", "Color", "Substrate", "Surface Texture", "Reproductive Structures", "Size"`;

    case "moss":
      return `
TAXON-SPECIFIC GUIDANCE (Moss):
- For idTips: Focus on growth form (cushion, mat, feather), leaf shape under hand lens, sporophyte (capsule) shape, habitat preference, and color (which changes with moisture).
- For seasonality: Sporophyte development timing, color changes with hydration/season. Most mosses are evergreen but some are more visible in wet seasons.
- Label suggestions for idTips: "Growth Form", "Leaves", "Sporophytes", "Color", "Habitat", "Texture"`;

    case "mammal":
      return `
TAXON-SPECIFIC GUIDANCE (Mammal):
- For idTips: Focus on size, body shape, fur color/pattern, ear shape, tail, tracks, and typical behavior. Include sign (scat, burrows, gnaw marks) that helps confirm ID.
- For seasonality: Activity patterns by season, hibernation, breeding season, molt timing (winter coat vs. summer coat), migration if applicable.
- Label suggestions for idTips: "Size & Shape", "Fur", "Tracks", "Behavior", "Sign", "Habitat"`;

    case "reptile":
      return `
TAXON-SPECIFIC GUIDANCE (Reptile):
- For idTips: Focus on scale pattern, color/pattern, head shape (venomous vs. non-venomous for snakes), size, and habitat preference. ALWAYS include safety notes for venomous species.
- For seasonality: Basking season, brumation timing, breeding/egg-laying period, hatchling emergence.
- Label suggestions for idTips: "Pattern", "Head Shape", "Scales", "Size", "Behavior", "Habitat"`;

    case "amphibian":
      return `
TAXON-SPECIFIC GUIDANCE (Amphibian):
- For idTips: Focus on skin texture, color/pattern, size, call description (for frogs — phonetic if possible), eye characteristics, and habitat.
- For seasonality: Breeding/calling season, metamorphosis timing, migration to breeding pools, hibernation.
- Label suggestions for idTips: "Skin", "Color/Pattern", "Call", "Size", "Eyes", "Habitat"`;

    case "arachnid":
      return `
TAXON-SPECIFIC GUIDANCE (Arachnid):
- For idTips: Focus on web type (for spiders), body shape, color/markings, size, eye arrangement, and typical habitat/behavior.
- For seasonality: Peak activity period, overwintering behavior, mating displays, egg sac timing.
- Label suggestions for idTips: "Body Shape", "Markings", "Web", "Size", "Eyes", "Behavior"`;

    case "mollusk":
      return `
TAXON-SPECIFIC GUIDANCE (Mollusk):
- For idTips: Focus on shell shape/coiling (or body form for slugs), color and banding pattern, size, aperture shape, and habitat.
- For seasonality: Activity peaks with moisture, breeding season, shell condition by season.
- Label suggestions for idTips: "Shell", "Color/Pattern", "Size", "Aperture", "Habitat", "Behavior"`;

    case "fish":
      return `
TAXON-SPECIFIC GUIDANCE (Fish):
- For idTips: Focus on body shape, fin configuration, color pattern, mouth position (terminal/sub-terminal/superior), size, and habitat preference (stream vs. lake, water depth).
- For seasonality: Spawning season, seasonal movements, color changes during breeding.
- Label suggestions for idTips: "Body Shape", "Fins", "Color", "Mouth", "Size", "Habitat"`;

    default:
      return "";
  }
}

// ============================================================
// Species content generation
// ============================================================

/**
 * Generate rich educational content for a species page.
 */
export async function generateSpeciesContent(params: {
  commonName: string;
  scientificName: string;
  familyName: string;
  familyCommonName: string;
  genusName: string;
  genusCommonName: string;
  orderName: string;
  observationCount: number;
  establishmentMeans?: string;
  relatedSpecies: { commonName: string; scientificName: string }[];
  className?: string;
  iconicTaxon?: string;
  referenceText?: string;
}): Promise<GeneratedSpeciesContent> {
  const anthropic = getClient();

  const relatedList = params.relatedSpecies
    .map((s) => `${s.commonName} (${s.scientificName})`)
    .join(", ");

  const taxonType = detectTaxonType(params);
  const taxonGuidance = getTaxonTypeGuidance(taxonType);

  // Determine the organism word based on type
  const organismWords: Record<TaxonType, string> = {
    conifer: "tree", angiosperm: "plant", fern: "fern", moss: "moss",
    fungus: "fungus", bird: "bird", insect: "insect", lichen: "lichen",
    mammal: "mammal", reptile: "reptile", amphibian: "amphibian",
    arachnid: "arachnid", mollusk: "mollusk", fish: "fish",
    "general-plant": "organism",
  };
  const organismWord = organismWords[taxonType] || "organism";

  const prompt = `You are writing content for the New England Nature Explorer, a friendly educational website teaching people to identify ${organismWord}s in New England. Write for a general audience — adults and kids alike. Use common names primarily. Explain jargon when used. Include sensory details (touch, smell, texture) in ID tips. Be engaging but accurate.

Species: ${params.commonName} (${params.scientificName})
Family: ${params.familyCommonName} (${params.familyName})
Genus: ${params.genusCommonName} (${params.genusName})
Order: ${params.orderName}
Observation count in New England: ${params.observationCount}
${params.establishmentMeans ? `Status: ${params.establishmentMeans}` : ""}
Related species in same genus: ${relatedList || "None in dataset"}
${params.referenceText || ""}
${taxonGuidance}

Generate a JSON object with these fields:

1. "nameStory" (string): Why does this species have this common name? Tell the story in 2-3 engaging sentences. Include etymology if interesting.

2. "description" (string): What is this ${organismWord}? A plain-language overview in 3-4 sentences that a beginner would understand. What does it look like overall? How big does it get?

3. "idTips" (array of objects): 4-6 identification tips. Each has:
   - "label" (string): Short feature name (use the label suggestions above if provided)
   - "description" (string): Practical field description with sensory details
   - "isPrimary" (boolean): true for the SINGLE most diagnostic feature, false for others

4. "habitat" (string): Where in New England you'd find this. Be specific about terrain, soil type, elevation, associated species. 2-3 sentences.

5. "seasonality" (object with "spring", "summer", "fall", "winter" string fields): What to look for in each season. Be specific about what's observable and useful for identification in each season. 1-2 sentences each.

6. "funFact" (string): One genuinely surprising, memorable fact. Should create a "wow" moment. Not textbook trivia — something that makes someone want to tell a friend.

7. "confusionNotes" (string or null): What it's commonly confused with and how to tell them apart. Include a simple memory trick if possible. Null if not commonly confused with anything.

8. "contextualKnowledge" (string or null): Any naming confusions, cultural notes, or things a learner should know (like the "cedar" confusion, or that hemlock the tree is unrelated to hemlock the poison). Null if none.

9. "compareHints" (string): How this species differs from its closest relatives in the same genus. If it's the only species in its genus in the region, compare with the most similar species in the family. 2-3 sentences.

Respond with ONLY the JSON object, no markdown fences or explanation.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.usage) {
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON — strip markdown fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as GeneratedSpeciesContent;
}

// ============================================================
// Short species content generation (for tiered mode)
// ============================================================

/**
 * Generate minimal content for low-observation species.
 * Uses Haiku for cost savings and generates fewer fields.
 */
export async function generateShortSpeciesContent(params: {
  commonName: string;
  scientificName: string;
  familyName: string;
  familyCommonName: string;
  genusName: string;
  genusCommonName: string;
  orderName: string;
  observationCount: number;
  establishmentMeans?: string;
  className?: string;
}): Promise<GeneratedSpeciesContent> {
  const anthropic = getClient();

  const taxonType = detectTaxonType(params);
  const organismWord =
    taxonType === "fungus" ? "fungus"
      : taxonType === "bird" ? "bird"
        : taxonType === "insect" ? "insect"
          : taxonType === "lichen" ? "lichen"
            : "plant";

  const prompt = `Write brief educational content for ${params.commonName} (${params.scientificName}), a ${organismWord} in the ${params.familyCommonName} family found in New England.

Generate a JSON object with:
1. "description" (string): 2-sentence overview
2. "idTips" (array): 2-3 key identification tips, each with "label" (string), "description" (string), "isPrimary" (boolean — true for the most diagnostic one)
3. "habitat" (string): 1 sentence about habitat
4. "funFact" (string): 1 brief interesting fact

Respond with ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.usage) {
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Fill in missing fields with empty defaults for compatibility
  return {
    nameStory: "",
    description: parsed.description || "",
    idTips: parsed.idTips || [],
    habitat: parsed.habitat || "",
    seasonality: { spring: "", summer: "", fall: "", winter: "" },
    funFact: parsed.funFact || "",
    confusionNotes: null,
    contextualKnowledge: null,
    compareHints: "",
  };
}

// ============================================================
// Group content generation
// ============================================================

/**
 * Generate content for a taxonomy group (family, genus, order, etc.).
 */
export async function generateGroupContent(params: {
  name: string;
  commonName: string;
  rank: string;
  childNames: string[];
  speciesCount: number;
}): Promise<GeneratedGroupContent> {
  const anthropic = getClient();

  const prompt = `You are writing content for the New England Nature Explorer, a friendly educational website. Write a brief description of this taxonomic group for someone exploring the tree of life.

Group: ${params.commonName} (${params.name})
Rank: ${params.rank}
Contains: ${params.childNames.join(", ")}
Total species in New England: ${params.speciesCount}

Generate a JSON object with:
1. "description" (string): What defines this group? What do its members have in common? 2-3 sentences, plain language.
2. "distinguishingFeatures" (string): What makes this group different from related groups? 1-2 sentences.
3. "funFact" (string): One interesting fact about this group.

Respond with ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.usage) {
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as GeneratedGroupContent;
}
