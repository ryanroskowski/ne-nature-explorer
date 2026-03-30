/**
 * Stage 5: Assemble final data files for the Next.js app
 *
 * Combines all pipeline outputs into the final data/ directory structure
 * that the frontend reads at build time.
 *
 * Now group-aware: reads from data/pipeline/{group}/ and writes to data/.
 */

import fs from "fs";
import path from "path";
import type { PipelineSpecies, PipelinePhoto, GeneratedSpeciesContent, GeneratedGroupContent, PipelineSpeciesTraits } from "./lib/types";
import type {
  TaxonomyNode,
  SpeciesData,
  SpeciesPhoto,
  SpeciesAudio,
  BreadcrumbItem,
  RelatedSpecies,
  AbundanceTier,
  CommonalityEntry,
  SearchEntry,
  BrowseEntry,
  SpeciesTraits,
  SeasonalGuide,
  MonthGuide,
  SeasonalHighlight,
  SeasonalSpeciesEntry,
  GroupInfo,
} from "../lib/types";
import type { TaxonGroupConfig } from "./lib/groups";

const OUTPUT_DIR = path.join(process.cwd(), "data");

export function assemble(
  groupKey: string = "plants",
  groupConfig?: TaxonGroupConfig
): void {
  const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline", groupKey);
  const groupLabel = groupConfig?.label || "Plants";

  console.log("\n=== Stage 5: Assemble Final Data ===");
  console.log(`Group: ${groupLabel} (${groupKey})`);
  console.log(`Pipeline dir: ${PIPELINE_DIR}`);

  function loadJson<T>(filename: string): T {
    const filePath = path.join(PIPELINE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing pipeline file: ${filePath}. Run earlier stages first.`);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  function loadJsonOptional<T>(filename: string): T | null {
    const filePath = path.join(PIPELINE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  // Load all pipeline outputs
  const speciesList: PipelineSpecies[] = loadJson("species-enriched.json");
  const taxonomyTree: TaxonomyNode = loadJson("taxonomy-tree.json");
  const photosData: Record<string, PipelinePhoto[]> = loadJson("photos.json");
  const speciesContent: Record<string, GeneratedSpeciesContent> =
    loadJsonOptional("species-content.json") || {};
  const groupContent: Record<string, GeneratedGroupContent> =
    loadJsonOptional("group-content.json") || {};

  // Load AI photo scores from cache to filter/reorder photos
  const { getCached } = require("./lib/cache");
  interface PhotoScore { photoId: number; score: number; category: string; reasoning: string; }
  interface ScoredPhotos { scores: PhotoScore[]; selected: number[]; }
  const photoScoresMap = new Map<string, ScoredPhotos>();
  for (const taxonId of Object.keys(photosData)) {
    const cacheKey = `photo_scores_${taxonId}`;
    const cached = getCached<ScoredPhotos>("photo_scores", cacheKey);
    if (cached) photoScoresMap.set(taxonId, cached);
  }
  console.log(`  Loaded photo scores for ${photoScoresMap.size} species`);

  const traitsMap: Record<string, PipelineSpeciesTraits> =
    loadJsonOptional("species-traits.json") || {};

  // Load audio data (from Stage 7 for birds, Stage 8 for amphibians)
  interface AudioEntry {
    xenoCantoId?: string;
    iNatObservationId?: string;
    type: string;
    label?: string;
    audioUrl: string;
    pageUrl: string;
    recordist: string;
    license: string;
    quality: string;
    length: string;
    location: string;
    sonogramUrl: string;
    source?: string;
  }
  const AUDIO_GROUPS = ["birds", "amphibians", "insects"];
  const audioData: Record<string, AudioEntry[]> =
    AUDIO_GROUPS.includes(groupKey) ? (loadJsonOptional("audio.json") || {}) : {};
  if (AUDIO_GROUPS.includes(groupKey) && Object.keys(audioData).length > 0) {
    console.log(`  Loaded audio data for ${Object.keys(audioData).length} ${groupKey} species`);
  }

  if (Object.keys(speciesContent).length === 0) {
    console.warn("  Note: No species content found. Species pages will have placeholder text.");
  }

  console.log(`Loaded ${speciesList.length} species`);

  // Compute abundance tiers
  const tiers = computeAbundanceTiers(speciesList);

  // Build species index for genus-level grouping
  const genusSiblings = new Map<string, PipelineSpecies[]>();
  for (const s of speciesList) {
    const genus = s.genusName || "Unknown";
    if (!genusSiblings.has(genus)) genusSiblings.set(genus, []);
    genusSiblings.get(genus)!.push(s);
  }

  // Assemble individual species JSON files
  const speciesDir = path.join(OUTPUT_DIR, "species");
  fs.mkdirSync(speciesDir, { recursive: true });

  const allSpeciesData: SpeciesData[] = [];

  for (const species of speciesList) {
    const slug = slugify(species.scientificName);
    const content = speciesContent[species.taxonId.toString()];
    const rawPhotos = photosData[species.taxonId.toString()] || [];
    const scored = photoScoresMap.get(species.taxonId.toString());

    // Filter and reorder photos using AI scores when available
    let photos: PipelinePhoto[];
    if (scored) {
      const scoreMap = new Map(scored.scores.map(s => [s.photoId, s]));
      // Filter out photos scored <= 2 (dead specimens, inappropriate)
      const filtered = rawPhotos.filter(p => {
        const s = scoreMap.get(p.id);
        return !s || s.score > 2;
      });
      // Put AI-selected photos first (in selected order), then remaining by score desc
      const selectedSet = new Set(scored.selected);
      const selected = scored.selected
        .map(id => filtered.find(p => p.id === id))
        .filter(Boolean) as PipelinePhoto[];
      const rest = filtered
        .filter(p => !selectedSet.has(p.id))
        .sort((a, b) => {
          const sa = scoreMap.get(a.id)?.score || 5;
          const sb = scoreMap.get(b.id)?.score || 5;
          return sb - sa;
        });
      photos = [...selected, ...rest];
    } else {
      photos = rawPhotos;
    }

    // Build breadcrumb
    const breadcrumb = buildBreadcrumb(species, groupLabel);

    // Build related species list
    const siblings = (genusSiblings.get(species.genusName || "") || [])
      .filter((s) => s.taxonId !== species.taxonId)
      .map((s) => {
        const sibContent = speciesContent[s.taxonId.toString()];
        return {
          slug: slugify(s.scientificName),
          commonName: s.commonName,
          scientificName: s.scientificName,
          thumbnailUrl: s.defaultPhotoUrl,
          distinction: sibContent?.compareHints?.split(".")[0] + "." || "",
        } satisfies RelatedSpecies;
      });

    const speciesData: SpeciesData = {
      slug,
      taxonId: species.taxonId,
      group: groupKey,
      commonName: species.commonName,
      scientificName: species.scientificName,
      family: species.familyName || "Unknown",
      familyCommonName: species.familyCommonName || "Unknown",
      genus: species.genusName || "Unknown",
      genusCommonName: species.genusCommonName || "Unknown",
      order: species.orderName || "Unknown",
      orderCommonName: species.orderCommonName || "Unknown",
      breadcrumb,
      observationCount: species.observationCount,
      abundanceTier: tiers.get(species.taxonId) || "moderate",
      photos: photos.map(
        (p) =>
          ({
            id: p.id,
            mediumUrl: p.mediumUrl,
            largeUrl: p.largeUrl,
            attribution: p.attribution,
            licenseCode: p.licenseCode,
            observationUrl: `https://www.inaturalist.org/observations/${p.observationId}`,
          }) satisfies SpeciesPhoto
      ),
      nameStory: content?.nameStory || "",
      description: content?.description || "",
      idTips: content?.idTips || [],
      habitat: content?.habitat || "",
      seasonality: content?.seasonality || {
        spring: "",
        summer: "",
        fall: "",
        winter: "",
      },
      funFact: content?.funFact || "",
      confusionNotes: content?.confusionNotes || null,
      contextualKnowledge: content?.contextualKnowledge || null,
      compareHints: content?.compareHints || "",
      relatedSpecies: siblings,
      // Audio recordings (birds, amphibians)
      ...(audioData[species.taxonId.toString()]?.length
        ? {
            audio: audioData[species.taxonId.toString()].map(
              (a): SpeciesAudio => ({
                xenoCantoId: a.xenoCantoId || a.iNatObservationId || "",
                type: a.type,
                ...(a.label ? { label: a.label } : {}),
                audioUrl: a.audioUrl,
                pageUrl: a.pageUrl,
                recordist: a.recordist,
                license: a.license,
                quality: a.quality,
                length: a.length,
                location: a.location,
                sonogramUrl: a.sonogramUrl || "",
              })
            ),
          }
        : {}),
      isNative: traitsMap[species.taxonId.toString()]?.isNative,
      establishmentMeans: species.establishmentMeans,
      wikipediaUrl: species.wikipediaUrl,
      iNaturalistUrl: `https://www.inaturalist.org/taxa/${species.taxonId}`,
      // Xeno-canto species page (birds, amphibians with xeno-canto audio)
      ...(AUDIO_GROUPS.includes(groupKey) && audioData[species.taxonId.toString()]?.some(a => !a.iNatObservationId)
        ? { xenoCantoUrl: `https://xeno-canto.org/species/${species.scientificName.replace(" ", "-")}` }
        : {}),
    };

    // Write individual species file
    const filePath = path.join(speciesDir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(speciesData, null, 2));
    allSpeciesData.push(speciesData);
  }

  console.log(`Written ${allSpeciesData.length} species files`);

  // Enrich taxonomy tree with group content
  enrichTreeContent(taxonomyTree, groupContent);

  // Write taxonomy tree (per-group)
  const treePath = path.join(OUTPUT_DIR, `taxonomy-${groupKey}.json`);
  fs.writeFileSync(treePath, JSON.stringify(taxonomyTree, null, 2));
  console.log(`Written taxonomy tree to taxonomy-${groupKey}.json`);

  // Build commonality ranking (per-group)
  const commonality: CommonalityEntry[] = allSpeciesData
    .sort((a, b) => b.observationCount - a.observationCount)
    .map((s) => ({
      slug: s.slug,
      commonName: s.commonName,
      scientificName: s.scientificName,
      family: s.family,
      familyCommonName: s.familyCommonName,
      group: groupKey,
      observationCount: s.observationCount,
      abundanceTier: s.abundanceTier,
      thumbnailUrl: s.photos[0]?.mediumUrl,
      photos: s.photos.slice(0, 4).map((p) => ({ mediumUrl: p.mediumUrl })),
    }));

  const commonalityPath = path.join(OUTPUT_DIR, `commonality-${groupKey}.json`);
  fs.writeFileSync(commonalityPath, JSON.stringify(commonality, null, 2));
  console.log(`Written commonality ranking to commonality-${groupKey}.json`);

  // Build search index (per-group, with group field)
  const searchIndex: SearchEntry[] = [];

  // Add species
  for (const s of allSpeciesData) {
    searchIndex.push({
      slug: s.slug,
      commonName: s.commonName,
      scientificName: s.scientificName,
      family: s.family,
      familyCommonName: s.familyCommonName,
      genus: s.genus,
      group: groupKey,
      type: "species",
    });
  }

  // Add unique genera and families
  const seenGenera = new Set<string>();
  const seenFamilies = new Set<string>();

  for (const s of speciesList) {
    if (s.genusName && !seenGenera.has(s.genusName)) {
      seenGenera.add(s.genusName);
      searchIndex.push({
        slug: `explore/${slugify(s.genusCommonName || s.genusName)}`,
        commonName: s.genusCommonName || s.genusName,
        scientificName: s.genusName,
        family: s.familyName || "",
        familyCommonName: s.familyCommonName || "",
        genus: s.genusName,
        group: groupKey,
        type: "genus",
      });
    }
    if (s.familyName && !seenFamilies.has(s.familyName)) {
      seenFamilies.add(s.familyName);
      searchIndex.push({
        slug: `explore/${slugify(s.familyCommonName || s.familyName)}`,
        commonName: s.familyCommonName || s.familyName,
        scientificName: s.familyName,
        family: s.familyName,
        familyCommonName: s.familyCommonName || "",
        genus: "",
        group: groupKey,
        type: "family",
      });
    }
  }

  const searchPath = path.join(OUTPUT_DIR, `search-index-${groupKey}.json`);
  fs.writeFileSync(searchPath, JSON.stringify(searchIndex, null, 2));
  console.log(`Written search index to search-index-${groupKey}.json (${searchIndex.length} entries)`);

  // Build browse index (requires trait data from Stage 6)
  if (traitsMap && Object.keys(traitsMap).length > 0) {
    const browseIndex: BrowseEntry[] = allSpeciesData
      .sort((a, b) => b.observationCount - a.observationCount)
      .map((s) => {
        const rawTraits = traitsMap[s.taxonId.toString()];
        const traits: SpeciesTraits = rawTraits
          ? (rawTraits as unknown as SpeciesTraits)
          : getDefaultTraits(groupKey);
        return {
          slug: s.slug,
          commonName: s.commonName,
          scientificName: s.scientificName,
          family: s.family,
          familyCommonName: s.familyCommonName,
          group: groupKey,
          abundanceTier: s.abundanceTier,
          thumbnailUrl: s.photos[0]?.mediumUrl,
          photos: s.photos.slice(0, 6).map((p: { mediumUrl: string }) => ({ mediumUrl: p.mediumUrl })),
          traits,
        };
      });

    const browsePath = path.join(OUTPUT_DIR, `browse-index-${groupKey}.json`);
    fs.writeFileSync(browsePath, JSON.stringify(browseIndex));
    console.log(`Written browse index to browse-index-${groupKey}.json (${browseIndex.length} entries)`);

    // Build seasonal guide
    const seasonalGuide = buildSeasonalGuide(allSpeciesData, traitsMap, speciesContent);
    const seasonalPath = path.join(OUTPUT_DIR, `seasonal-guide-${groupKey}.json`);
    fs.writeFileSync(seasonalPath, JSON.stringify(seasonalGuide, null, 2));
    console.log(`Written seasonal guide to seasonal-guide-${groupKey}.json`);
  } else {
    console.log("Skipping browse index and seasonal guide (no trait data — run Stage 6 first)");
  }

  // Update groups.json metadata
  updateGroupsMetadata(groupKey, groupLabel, allSpeciesData.length);

  console.log("\nAssembly complete!");
}

// ============================================================
// Seasonal guide builder
// ============================================================

const MONTH_SEASONS: Record<string, string> = {
  january: "winter", february: "winter", march: "spring",
  april: "spring", may: "spring", june: "summer",
  july: "summer", august: "summer", september: "fall",
  october: "fall", november: "fall", december: "winter",
};

const SEASON_HIGHLIGHTS: Record<string, { feature: string; description: string; icon: string; tags: string[] }[]> = {
  spring: [
    { feature: "Spring Wildflowers", description: "Wildflowers emerging and blooming across New England", icon: "🌸", tags: ["flowers"] },
    { feature: "Emerging Leaves", description: "Fresh foliage unfurling on trees, shrubs, and herbs", icon: "🌱", tags: ["new-leaves"] },
    { feature: "Fiddleheads Unfurling", description: "Ferns pushing up their distinctive coiled fronds", icon: "🌿", tags: ["fiddleheads"] },
    { feature: "Tree Catkins & Pollen", description: "Trees releasing pollen via dangling catkins", icon: "🌾", tags: ["catkins", "pollen"] },
  ],
  summer: [
    { feature: "Summer Blooms", description: "Peak flowering season across meadows and gardens", icon: "🌻", tags: ["flowers"] },
    { feature: "Developing Fruit", description: "Berries, drupes, and other fruits ripening", icon: "🫐", tags: ["fruit", "berries"] },
    { feature: "Cone Development", description: "Conifer cones maturing through the summer", icon: "🌲", tags: ["cones"] },
  ],
  fall: [
    { feature: "Fall Color", description: "Spectacular autumn foliage across New England", icon: "🍂", tags: ["fall-color"] },
    { feature: "Berries & Fruit", description: "Late-season berries and fruit ready for harvest or wildlife", icon: "🍒", tags: ["berries", "fruit"] },
    { feature: "Seeds & Nuts", description: "Trees and plants releasing seeds for the next generation", icon: "🌰", tags: ["seeds", "pods", "cones"] },
  ],
  winter: [
    { feature: "Evergreen Identification", description: "Conifers and broadleaf evergreens stand out in winter", icon: "🌲", tags: ["evergreen"] },
    { feature: "Bark Identification", description: "With leaves gone, bark patterns become the key identifier", icon: "🪵", tags: ["bark"] },
    { feature: "Persistent Fruit & Seeds", description: "Dried fruit, cones, and seed heads that last through winter", icon: "🫘", tags: ["persistent-fruit", "cones"] },
    { feature: "Winter Buds", description: "Buds reveal which tree is which before spring arrives", icon: "🫑", tags: ["buds"] },
  ],
};

function buildSeasonalGuide(
  allSpecies: SpeciesData[],
  traitsMap: Record<string, PipelineSpeciesTraits>,
  contentData: Record<string, GeneratedSpeciesContent>
): SeasonalGuide {
  const months: Record<string, MonthGuide> = {};

  for (const [month, season] of Object.entries(MONTH_SEASONS)) {
    const highlightDefs = SEASON_HIGHLIGHTS[season];
    const highlights: SeasonalHighlight[] = [];

    for (const def of highlightDefs) {
      const matchingSpecies: SeasonalSpeciesEntry[] = [];

      for (const s of allSpecies) {
        const traits = traitsMap[s.taxonId.toString()];
        if (!traits) continue;

        const seasonHighlights = traits.seasonalHighlights[season as keyof typeof traits.seasonalHighlights] || [];
        const hasMatch = def.tags.some((tag) => seasonHighlights.includes(tag));
        if (!hasMatch) continue;

        const content = contentData[s.taxonId.toString()];
        const note = content?.seasonality?.[season as keyof typeof content.seasonality] || "";

        matchingSpecies.push({
          slug: s.slug,
          commonName: s.commonName,
          scientificName: s.scientificName,
          thumbnailUrl: s.photos[0]?.mediumUrl,
          abundanceTier: s.abundanceTier,
          note: note.length > 200 ? note.substring(0, 197) + "..." : note,
        });
      }

      // Sort by abundance (very-common first) and take top 30
      const tierOrder: Record<string, number> = {
        "very-common": 0, "common": 1, "moderate": 2, "uncommon": 3, "rare": 4,
      };
      matchingSpecies.sort(
        (a, b) => (tierOrder[a.abundanceTier] || 4) - (tierOrder[b.abundanceTier] || 4)
      );

      if (matchingSpecies.length >= 3) {
        highlights.push({
          feature: def.feature,
          description: def.description,
          icon: def.icon,
          species: matchingSpecies.slice(0, 30),
        });
      }
    }

    months[month] = { season, highlights };
  }

  return { months };
}

/** Default traits fallback when no trait data exists for a species */
function getDefaultTraits(groupKey: string): SpeciesTraits {
  const base = {
    habitatTypes: [],
    isNative: true,
    seasonalHighlights: { spring: [], summer: [], fall: [], winter: [] },
  };

  const animalGroups = ["birds", "mammals", "reptiles", "amphibians", "fish", "arachnids", "crustaceans", "myriapods", "cnidarians", "echinoderms"];
  if (animalGroups.includes(groupKey)) {
    return { ...base, _schemaType: "animal" as const, bodyType: "unknown", sizeClass: "medium", activityPattern: "diurnal", dietType: "omnivore" };
  }
  if (groupKey === "fungi") {
    return { ...base, _schemaType: "fungus" as const, fruitingBodyType: "cap-and-stem", colorPrimary: "brown" };
  }
  if (groupKey === "lichens") {
    return { ...base, _schemaType: "lichen" as const, growthForm: "foliose" as any, colorPrimary: "green" };
  }
  if (groupKey === "insects") {
    return { ...base, _schemaType: "animal" as const, bodyType: "insect", sizeClass: "small", activityPattern: "diurnal" };
  }
  if (groupKey === "mollusks") {
    return { ...base, _schemaType: "animal" as const, bodyType: "mollusk", sizeClass: "small" };
  }
  // Default: plant
  return {
    ...base,
    _schemaType: "plant" as const,
    growthForm: "herb",
    leafType: "none",
    flowerColors: [],
    flowerShape: "none",
    fruitType: "none",
    bloomPeriod: null,
  };
}

/** Group icons for the groups.json metadata file */
const GROUP_ICONS: Record<string, string> = {
  plants: "🌿",
  fungi: "🍄",
  birds: "🐦",
  mammals: "🦌",
  reptiles: "🐍",
  amphibians: "🐸",
  insects: "🦋",
  lichens: "🌱",
  arachnids: "🕷️",
  mollusks: "🐚",
  fish: "🐟",
  crustaceans: "🦀",
  myriapods: "🐛",
  cnidarians: "🌊",
  echinoderms: "⭐",
};

/** Update data/groups.json with this group's metadata (merge with existing) */
function updateGroupsMetadata(groupKey: string, groupLabel: string, speciesCount: number): void {
  const groupsPath = path.join(OUTPUT_DIR, "groups.json");

  // Read existing groups.json or start fresh
  let groups: Record<string, GroupInfo> = {};
  if (fs.existsSync(groupsPath)) {
    try {
      groups = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));
    } catch {
      groups = {};
    }
  }

  // Update this group's entry
  groups[groupKey] = {
    key: groupKey,
    label: groupLabel,
    icon: GROUP_ICONS[groupKey] || "🔬",
    speciesCount,
    status: "active",
  };

  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
  console.log(`Updated groups.json (${Object.keys(groups).length} groups)`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function computeAbundanceTiers(
  speciesList: PipelineSpecies[]
): Map<number, AbundanceTier> {
  const sorted = [...speciesList].sort(
    (a, b) => b.observationCount - a.observationCount
  );
  const total = sorted.length;
  const tiers = new Map<number, AbundanceTier>();

  sorted.forEach((s, i) => {
    const percentile = i / total;
    let tier: AbundanceTier;
    if (percentile < 0.2) tier = "very-common";
    else if (percentile < 0.4) tier = "common";
    else if (percentile < 0.6) tier = "moderate";
    else if (percentile < 0.8) tier = "uncommon";
    else tier = "rare";
    tiers.set(s.taxonId, tier);
  });

  return tiers;
}

function buildBreadcrumb(species: PipelineSpecies, groupLabel: string = "Plants"): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { label: groupLabel, rank: "kingdom", slug: "explore" },
  ];

  if (species.phylumName) {
    crumbs.push({
      label: species.phylumCommonName || species.phylumName,
      rank: "phylum",
      slug: `explore/${slugify(species.phylumCommonName || species.phylumName)}`,
    });
  }
  if (species.className) {
    crumbs.push({
      label: species.classCommonName || species.className,
      rank: "class",
      slug: `explore/${slugify(species.classCommonName || species.className)}`,
    });
  }
  if (species.orderName) {
    crumbs.push({
      label: species.orderCommonName || species.orderName,
      rank: "order",
      slug: `explore/${slugify(species.orderCommonName || species.orderName)}`,
    });
  }
  if (species.familyName) {
    crumbs.push({
      label: species.familyCommonName || species.familyName,
      rank: "family",
      slug: `explore/${slugify(species.familyCommonName || species.familyName)}`,
    });
  }
  if (species.genusName) {
    crumbs.push({
      label: species.genusCommonName || species.genusName,
      rank: "genus",
      slug: `explore/${slugify(species.genusCommonName || species.genusName)}`,
    });
  }
  crumbs.push({
    label: species.commonName,
    rank: "species",
    slug: `species/${slugify(species.scientificName)}`,
  });

  return crumbs;
}

function enrichTreeContent(
  node: TaxonomyNode,
  groupContent: Record<string, GeneratedGroupContent>
): void {
  const content = groupContent[node.id.toString()];
  if (content) {
    node.description = content.description;
    node.distinguishingFeatures = content.distinguishingFeatures;
    node.funFact = content.funFact;
  }

  for (const child of node.children) {
    enrichTreeContent(child, groupContent);
  }
}

// Run directly
if (require.main === module) {
  const { resolveGroup, TAXON_GROUPS } = require("./lib/groups");

  const args = process.argv.slice(2);
  const groupResult = resolveGroup(args);
  const groupKey = groupResult?.key || "plants";
  const groupConfig = groupResult?.config || TAXON_GROUPS.plants;

  try {
    assemble(groupKey, groupConfig);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
