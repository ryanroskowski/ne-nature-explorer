/**
 * Stage 10: Classify insect ecological roles (pollinator, pest, beneficial)
 *
 * Uses family + diet heuristics for pollinator status (very reliable)
 * and a curated species/family list for pest status.
 *
 * Output: data/pipeline/insects/ecological-roles.json
 */

import fs from "fs";
import path from "path";

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
  familyName?: string;
}

interface SpeciesTraits {
  dietType?: string;
  isNative?: boolean;
  [key: string]: unknown;
}

export interface EcologicalRole {
  isPollinator: boolean;
  pollinatorType?: "primary" | "minor";  // primary = bees, butterflies; minor = occasional visitors
  isBeneficial: boolean;
  beneficialRole?: string;  // "predator", "decomposer", "parasitoid"
  isPest: boolean;
  pestLevel?: "minor" | "major";
  pestNote?: string;
}

// ============================================
// POLLINATOR CLASSIFICATION
// ============================================

// Primary pollinators — all species in these families are pollinators
const BEE_FAMILIES = new Set([
  "Apidae",        // bumble bees, honey bees, carpenter bees
  "Andrenidae",    // mining bees
  "Halictidae",    // sweat bees
  "Megachilidae",  // leafcutter bees, mason bees
  "Colletidae",    // cellophane bees
  "Melittidae",    // loosestrife bees
]);

// Butterfly families — pollinators when nectivore
const BUTTERFLY_FAMILIES = new Set([
  "Nymphalidae",   // brush-footed butterflies
  "Lycaenidae",    // blues, coppers, hairstreaks
  "Hesperiidae",   // skippers
  "Pieridae",      // whites, sulphurs
  "Papilionidae",  // swallowtails
  "Riodinidae",    // metalmarks
]);

// Moth families that are significant pollinators
const POLLINATOR_MOTH_FAMILIES = new Set([
  "Sphingidae",    // hawk moths — very important pollinators
]);

// Minor pollinator moth families (visit flowers but less significant)
const MINOR_POLLINATOR_MOTH_FAMILIES = new Set([
  "Saturniidae",   // giant silk moths
  "Erebidae",      // some visit flowers
  "Noctuidae",     // some visit flowers
]);

// Beetle families that pollinate
const POLLINATOR_BEETLE_FAMILIES = new Set([
  "Cantharidae",   // soldier beetles — common flower visitors
]);

// ============================================
// BENEFICIAL CLASSIFICATION
// ============================================

// Predatory insects — eat other insects (biological control)
const PREDATOR_FAMILIES = new Set([
  "Coccinellidae",   // lady beetles — eat aphids
  "Cicindelidae",    // tiger beetles
  "Carabidae",       // ground beetles
  // Dragonflies and damselflies
  "Libellulidae",    // skimmers
  "Gomphidae",       // clubtails
  "Corduliidae",     // emeralds
  "Aeshnidae",       // darners
  "Coenagrionidae",  // narrow-winged damselflies
  "Lestidae",        // spreadwings
  "Calopterygidae",  // jewelwings
  "Cordulegastridae", // spiketails
  "Macromiidae",     // cruisers
  // Others
  "Melyridae",       // soft-winged flower beetles (prey on small insects)
]);

// Parasitoid-associated families
const PARASITOID_FAMILIES = new Set([
  "Ripiphoridae",    // wedge-shaped beetles (parasitoids of other insects)
]);

// Decomposer families
const DECOMPOSER_FAMILIES = new Set([
  "Staphylinidae",   // rove beetles (carrion/decomposition)
  "Geotrupidae",     // earth-boring beetles
  "Dermestidae",     // carpet beetles (decomposers in nature)
  "Nitidulidae",     // sap beetles
  "Lampyridae",      // fireflies (larvae eat snails/slugs)
]);

// ============================================
// PEST CLASSIFICATION
// ============================================

// Known major pest species (by scientific name)
const MAJOR_PEST_SPECIES = new Set([
  "Lymantria dispar",           // Spongy Moth — major forest defoliator
  "Agrilus planipennis",        // Emerald Ash Borer — devastating tree pest
  "Popillia japonica",          // Japanese Beetle — widespread garden/ag pest
  "Anoplophora glabripennis",   // Asian Long-horned Beetle
  "Lycorma delicatula",         // Spotted Lanternfly
  "Halyomorpha halys",          // Brown Marmorated Stink Bug (not an insect order but check)
  "Pieris rapae",               // Small White (Cabbage White) — crop pest
]);

// Known minor pest species
const MINOR_PEST_SPECIES = new Set([
  "Harmonia axyridis",          // Asian Lady Beetle — nuisance pest
  "Ips typographus",            // European spruce bark beetle
  "Apis mellifera",             // (skip — beneficial despite being introduced)
  "Gryllotalpa gryllotalpa",    // European Mole Cricket — lawn/garden pest
  "Acheta domesticus",          // House Cricket — nuisance
  "Gryllodes sigillatus",       // Tropical House Cricket — nuisance
]);

// Families where introduced species are often pests
const PEST_RISK_FAMILIES: Record<string, { level: "minor" | "major"; note: string }> = {
  "Cerambycidae": { level: "minor", note: "Wood borer — can damage trees" },
  "Buprestidae": { level: "minor", note: "Wood/bark borer" },
  "Curculionidae": { level: "minor", note: "Weevil — may damage plants" },
  "Chrysomelidae": { level: "minor", note: "Leaf beetle — may damage foliage" },
  "Scarabaeidae": { level: "minor", note: "May damage roots or foliage" },
};

// Specific pest notes for major pests
const PEST_NOTES: Record<string, string> = {
  "Lymantria dispar": "Major forest defoliator — caterpillars strip hardwood trees",
  "Agrilus planipennis": "Devastating ash tree pest — has killed millions of ash trees",
  "Popillia japonica": "Widespread garden and agricultural pest — skeletonizes leaves",
  "Pieris rapae": "Common crop pest — caterpillars damage cabbage family plants",
  "Harmonia axyridis": "Nuisance pest — invades buildings in fall, displaces native lady beetles",
  "Gryllotalpa gryllotalpa": "Lawn and garden pest — tunneling damages roots",
};

function classifySpecies(
  species: PipelineSpecies,
  traits: SpeciesTraits
): EcologicalRole {
  const family = species.familyName || "";
  const diet = traits.dietType || "";
  const isNative = traits.isNative !== false; // default to native if unknown
  const sciName = species.scientificName;

  const role: EcologicalRole = {
    isPollinator: false,
    isBeneficial: false,
    isPest: false,
  };

  // === POLLINATOR ===
  if (BEE_FAMILIES.has(family)) {
    role.isPollinator = true;
    role.pollinatorType = "primary";
  } else if (BUTTERFLY_FAMILIES.has(family) && diet === "nectivore") {
    role.isPollinator = true;
    role.pollinatorType = "primary";
  } else if (POLLINATOR_MOTH_FAMILIES.has(family)) {
    role.isPollinator = true;
    role.pollinatorType = "primary";
  } else if (MINOR_POLLINATOR_MOTH_FAMILIES.has(family) && diet === "nectivore") {
    role.isPollinator = true;
    role.pollinatorType = "minor";
  } else if (POLLINATOR_BEETLE_FAMILIES.has(family)) {
    role.isPollinator = true;
    role.pollinatorType = "minor";
  }

  // === BENEFICIAL ===
  if (PREDATOR_FAMILIES.has(family)) {
    role.isBeneficial = true;
    role.beneficialRole = "predator";
  } else if (PARASITOID_FAMILIES.has(family)) {
    role.isBeneficial = true;
    role.beneficialRole = "parasitoid";
  } else if (DECOMPOSER_FAMILIES.has(family)) {
    role.isBeneficial = true;
    role.beneficialRole = "decomposer";
  } else if (role.isPollinator) {
    // All pollinators are beneficial
    role.isBeneficial = true;
    role.beneficialRole = "pollinator";
  }

  // === PEST ===
  if (MAJOR_PEST_SPECIES.has(sciName)) {
    role.isPest = true;
    role.pestLevel = "major";
    role.pestNote = PEST_NOTES[sciName] || undefined;
  } else if (MINOR_PEST_SPECIES.has(sciName) && sciName !== "Apis mellifera") {
    role.isPest = true;
    role.pestLevel = "minor";
    role.pestNote = PEST_NOTES[sciName] || undefined;
  } else if (!isNative && PEST_RISK_FAMILIES[family]) {
    // Introduced species in pest-risk families
    role.isPest = true;
    role.pestLevel = PEST_RISK_FAMILIES[family].level;
    role.pestNote = PEST_RISK_FAMILIES[family].note;
  }

  return role;
}

async function main() {
  console.log("\n=== Stage 10: Classify Insect Ecological Roles ===\n");

  const pipelineDir = path.join(process.cwd(), "data", "pipeline", "insects");
  const speciesListPath = path.join(pipelineDir, "species-enriched.json");
  const traitsPath = path.join(pipelineDir, "species-traits.json");

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesListPath, "utf-8")
  );
  const allTraits: Record<string, SpeciesTraits> = JSON.parse(
    fs.readFileSync(traitsPath, "utf-8")
  );

  console.log(`Classifying ${speciesList.length} insect species...\n`);

  const roles: Record<string, EcologicalRole> = {};

  let pollinatorCount = 0;
  let primaryPollCount = 0;
  let minorPollCount = 0;
  let beneficialCount = 0;
  let pestCount = 0;
  let majorPestCount = 0;

  for (const species of speciesList) {
    const traits = allTraits[species.taxonId.toString()] || {};
    const role = classifySpecies(species, traits);
    roles[species.taxonId.toString()] = role;

    if (role.isPollinator) {
      pollinatorCount++;
      if (role.pollinatorType === "primary") primaryPollCount++;
      else minorPollCount++;
    }
    if (role.isBeneficial) beneficialCount++;
    if (role.isPest) {
      pestCount++;
      if (role.pestLevel === "major") majorPestCount++;
    }
  }

  const outputPath = path.join(pipelineDir, "ecological-roles.json");
  fs.writeFileSync(outputPath, JSON.stringify(roles, null, 2));

  console.log(`=== Insect Ecological Roles Complete ===`);
  console.log(`  Total species: ${speciesList.length}`);
  console.log(`  Pollinators: ${pollinatorCount} (${primaryPollCount} primary, ${minorPollCount} minor)`);
  console.log(`  Beneficial: ${beneficialCount}`);
  console.log(`  Pests: ${pestCount} (${majorPestCount} major)`);
  console.log(`  Output: ${outputPath}\n`);

  // Show some examples
  console.log("Example classifications:");
  const examples = ["Apis mellifera", "Danaus plexippus", "Lymantria dispar", "Popillia japonica", "Libellula luctuosa", "Gryllus pennsylvanicus"];
  for (const name of examples) {
    const sp = speciesList.find(s => s.scientificName === name);
    if (sp) {
      const r = roles[sp.taxonId.toString()];
      const tags = [];
      if (r.isPollinator) tags.push(`pollinator(${r.pollinatorType})`);
      if (r.isBeneficial && r.beneficialRole !== "pollinator") tags.push(`beneficial(${r.beneficialRole})`);
      if (r.isPest) tags.push(`pest(${r.pestLevel})`);
      if (tags.length === 0) tags.push("none");
      console.log(`  ${sp.commonName}: ${tags.join(", ")}`);
    }
  }
}

main().catch(console.error);
