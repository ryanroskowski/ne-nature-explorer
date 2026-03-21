/**
 * Per-group browse filter configurations.
 *
 * Defines which trait filters to show in the TraitBrowser
 * and browse hub page for each taxon group.
 */

import type { TraitSchemaType } from "./types";

interface TraitFilterOption {
  value: string;
  label: string;
  icon?: string;
}

interface TraitFilterConfig {
  key: string;
  label: string;
  type: "grid" | "pills"; // grid = primary category selector, pills = secondary refinement
  options: TraitFilterOption[];
}

export interface GroupBrowseConfig {
  schemaType: TraitSchemaType;
  /** Label for the trait browse page (e.g. "Plant Type", "Bird Type") */
  traitBrowseTitle: string;
  /** Description for the trait browse page */
  traitBrowseDescription: string;
  /** Primary filter shown as a grid of cards */
  primaryFilter: TraitFilterConfig;
  /** Secondary filters shown as pill toggles in the refine panel */
  secondaryFilters: TraitFilterConfig[];
  /** Whether this group has a flower browser */
  hasFlowerBrowser: boolean;
  /** Browse hub card config */
  browseCards: {
    href: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    examples: string;
  }[];
}

// ============================================================
// Plant config
// ============================================================

const plantConfig: GroupBrowseConfig = {
  schemaType: "plant",
  traitBrowseTitle: "Browse by Plant Type",
  traitBrowseDescription: "Start with a growth form, then refine by leaf type, fruit, habitat, or native status.",
  primaryFilter: {
    key: "growthForm",
    label: "Growth Form",
    type: "grid",
    options: [
      { value: "tree", label: "Trees", icon: "🌲" },
      { value: "shrub", label: "Shrubs", icon: "🌿" },
      { value: "herb", label: "Herbs", icon: "🌸" },
      { value: "vine", label: "Vines", icon: "🌱" },
      { value: "grass-sedge", label: "Grasses & Sedges", icon: "🌾" },
      { value: "fern", label: "Ferns", icon: "🍃" },
      { value: "moss", label: "Mosses & Clubmosses", icon: "🪨" },
      { value: "aquatic", label: "Aquatic", icon: "💧" },
    ],
  },
  secondaryFilters: [
    {
      key: "leafType",
      label: "Leaf Type",
      type: "pills",
      options: [
        { value: "needles", label: "Needles" },
        { value: "broad-deciduous", label: "Broad Deciduous" },
        { value: "broad-evergreen", label: "Broad Evergreen" },
        { value: "fronds", label: "Fronds" },
        { value: "blades", label: "Blades" },
        { value: "scales", label: "Scales" },
      ],
    },
    {
      key: "fruitType",
      label: "Fruit / Seed Type",
      type: "pills",
      options: [
        { value: "cone", label: "Cone" },
        { value: "berry", label: "Berry" },
        { value: "nut-acorn", label: "Nut/Acorn" },
        { value: "drupe", label: "Drupe" },
        { value: "pod", label: "Pod" },
        { value: "capsule", label: "Capsule" },
        { value: "winged-seed", label: "Winged Seed" },
        { value: "achene", label: "Achene" },
        { value: "aggregate", label: "Aggregate" },
        { value: "spore", label: "Spore" },
      ],
    },
  ],
  hasFlowerBrowser: true,
  browseCards: [
    {
      href: "/browse/traits",
      icon: "🌲",
      title: "Browse by Plant Type",
      description: "Trees, shrubs, herbs, ferns — filter by growth form, leaf type, fruit type, and habitat.",
      color: "bg-forest/10 text-forest",
      examples: "Trees with cones, Shrubs with berries, Native ferns",
    },
    {
      href: "/browse/flowers",
      icon: "🌸",
      title: "Browse by Flower",
      description: "Find plants by flower color, shape, and bloom season. Start with what you see.",
      color: "bg-pink-100 text-pink-700",
      examples: "Pink bell-shaped, Yellow composites, Blue spring wildflowers",
    },
    {
      href: "/browse/monthly",
      icon: "📅",
      title: "Monthly Field Guide",
      description: "What's blooming, fruiting, and changing each month — based on real observation data.",
      color: "bg-amber-100 text-amber-700",
      examples: "March wildflowers, June bloom peak, October fall color",
    },
  ],
};

// ============================================================
// Animal config (birds, mammals, reptiles, amphibians, fish)
// ============================================================

const animalConfig: GroupBrowseConfig = {
  schemaType: "animal",
  traitBrowseTitle: "Browse by Type",
  traitBrowseDescription: "Start with a body type, then refine by size, activity pattern, diet, or habitat.",
  primaryFilter: {
    key: "bodyType",
    label: "Body Type",
    type: "grid",
    options: [
      { value: "songbird", label: "Songbirds", icon: "🐦" },
      { value: "raptor", label: "Raptors", icon: "🦅" },
      { value: "waterbird", label: "Waterbirds", icon: "🦆" },
      { value: "shorebird", label: "Shorebirds", icon: "🦩" },
      { value: "wader", label: "Waders", icon: "🦢" },
      { value: "rodent", label: "Rodents", icon: "🐿️" },
      { value: "carnivore", label: "Carnivores", icon: "🦊" },
      { value: "ungulate", label: "Ungulates", icon: "🦌" },
    ],
  },
  secondaryFilters: [
    {
      key: "sizeClass",
      label: "Size",
      type: "pills",
      options: [
        { value: "tiny", label: "Tiny" },
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
        { value: "very-large", label: "Very Large" },
      ],
    },
    {
      key: "activityPattern",
      label: "Activity",
      type: "pills",
      options: [
        { value: "diurnal", label: "Diurnal" },
        { value: "nocturnal", label: "Nocturnal" },
        { value: "crepuscular", label: "Crepuscular" },
      ],
    },
    {
      key: "dietType",
      label: "Diet",
      type: "pills",
      options: [
        { value: "herbivore", label: "Herbivore" },
        { value: "carnivore", label: "Carnivore" },
        { value: "omnivore", label: "Omnivore" },
        { value: "insectivore", label: "Insectivore" },
        { value: "granivore", label: "Granivore" },
        { value: "nectarivore", label: "Nectarivore" },
      ],
    },
  ],
  hasFlowerBrowser: false,
  browseCards: [
    {
      href: "/browse/traits",
      icon: "🔍",
      title: "Browse by Type",
      description: "Filter by body type, size, activity pattern, diet, and habitat.",
      color: "bg-forest/10 text-forest",
      examples: "Songbirds, Nocturnal carnivores, Waterbirds",
    },
    {
      href: "/browse/monthly",
      icon: "📅",
      title: "Monthly Field Guide",
      description: "What's active, migrating, or nesting each month — real observation data.",
      color: "bg-amber-100 text-amber-700",
      examples: "March arrivals, June nesting, October migration",
    },
  ],
};

// ============================================================
// Fungus config
// ============================================================

const fungusConfig: GroupBrowseConfig = {
  schemaType: "fungus",
  traitBrowseTitle: "Browse by Fruiting Body",
  traitBrowseDescription: "Start with a fruiting body type, then refine by cap shape, substrate, or season.",
  primaryFilter: {
    key: "fruitingBodyType",
    label: "Fruiting Body",
    type: "grid",
    options: [
      { value: "cap-and-stem", label: "Cap & Stem", icon: "🍄" },
      { value: "bracket", label: "Bracket/Shelf", icon: "🪵" },
      { value: "puffball", label: "Puffball", icon: "⚪" },
      { value: "cup", label: "Cup/Disc", icon: "🥣" },
      { value: "coral", label: "Coral/Club", icon: "🪸" },
      { value: "crust", label: "Crust/Skin", icon: "📜" },
      { value: "jelly", label: "Jelly", icon: "🫧" },
      { value: "other", label: "Other", icon: "🔬" },
    ],
  },
  secondaryFilters: [
    {
      key: "sporeStructure",
      label: "Spore Structure",
      type: "pills",
      options: [
        { value: "gills", label: "Gills" },
        { value: "pores", label: "Pores" },
        { value: "teeth", label: "Teeth" },
        { value: "smooth", label: "Smooth" },
        { value: "ridged", label: "Ridged" },
      ],
    },
    {
      key: "substrate",
      label: "Substrate",
      type: "pills",
      options: [
        { value: "soil", label: "Soil" },
        { value: "wood", label: "Wood" },
        { value: "leaf-litter", label: "Leaf Litter" },
        { value: "dung", label: "Dung" },
        { value: "moss", label: "Moss" },
      ],
    },
    {
      key: "colorPrimary",
      label: "Color",
      type: "pills",
      options: [
        { value: "white", label: "White" },
        { value: "brown", label: "Brown" },
        { value: "red", label: "Red" },
        { value: "orange", label: "Orange" },
        { value: "yellow", label: "Yellow" },
        { value: "gray", label: "Gray" },
        { value: "black", label: "Black" },
      ],
    },
  ],
  hasFlowerBrowser: false,
  browseCards: [
    {
      href: "/browse/traits",
      icon: "🍄",
      title: "Browse by Fruiting Body",
      description: "Cap & stem, bracket, puffball, coral — filter by shape, substrate, and color.",
      color: "bg-forest/10 text-forest",
      examples: "Gilled mushrooms on wood, White puffballs, Red bracket fungi",
    },
    {
      href: "/browse/monthly",
      icon: "📅",
      title: "Monthly Field Guide",
      description: "When different fungi fruit each month — real observation data.",
      color: "bg-amber-100 text-amber-700",
      examples: "April morels, July boletes, September chanterelles",
    },
  ],
};

// ============================================================
// Lichen config
// ============================================================

const lichenConfig: GroupBrowseConfig = {
  schemaType: "lichen",
  traitBrowseTitle: "Browse by Growth Form",
  traitBrowseDescription: "Start with a growth form, then refine by color or substrate.",
  primaryFilter: {
    key: "growthForm",
    label: "Growth Form",
    type: "grid",
    options: [
      { value: "foliose", label: "Foliose (Leafy)", icon: "🍃" },
      { value: "crustose", label: "Crustose (Crusty)", icon: "🪨" },
      { value: "fruticose", label: "Fruticose (Shrubby)", icon: "🌿" },
      { value: "squamulose", label: "Squamulose (Scaly)", icon: "🐉" },
    ],
  },
  secondaryFilters: [
    {
      key: "colorPrimary",
      label: "Color",
      type: "pills",
      options: [
        { value: "green", label: "Green" },
        { value: "gray", label: "Gray" },
        { value: "yellow", label: "Yellow" },
        { value: "orange", label: "Orange" },
        { value: "brown", label: "Brown" },
        { value: "white", label: "White" },
        { value: "black", label: "Black" },
      ],
    },
    {
      key: "substrate",
      label: "Substrate",
      type: "pills",
      options: [
        { value: "bark", label: "Bark" },
        { value: "rock", label: "Rock" },
        { value: "soil", label: "Soil" },
        { value: "wood", label: "Wood" },
      ],
    },
  ],
  hasFlowerBrowser: false,
  browseCards: [
    {
      href: "/browse/traits",
      icon: "🪨",
      title: "Browse by Growth Form",
      description: "Foliose, crustose, fruticose — filter by shape, color, and substrate.",
      color: "bg-forest/10 text-forest",
      examples: "Green foliose on bark, Orange crustose on rock",
    },
    {
      href: "/browse/monthly",
      icon: "📅",
      title: "Monthly Field Guide",
      description: "When to find lichens each month — real observation data.",
      color: "bg-amber-100 text-amber-700",
      examples: "March bark surveys, June fruiting bodies",
    },
  ],
};

// ============================================================
// Insect config
// ============================================================

const insectConfig: GroupBrowseConfig = {
  schemaType: "animal",
  traitBrowseTitle: "Browse by Type",
  traitBrowseDescription: "Start with an insect type, then refine by size, activity, or habitat.",
  primaryFilter: {
    key: "bodyType",
    label: "Insect Type",
    type: "grid",
    options: [
      { value: "butterfly", label: "Butterflies", icon: "🦋" },
      { value: "dragonfly", label: "Dragonflies", icon: "🪰" },
      { value: "bee", label: "Bees", icon: "🐝" },
      { value: "moth", label: "Moths", icon: "🦋" },
      { value: "beetle", label: "Beetles", icon: "🪲" },
      { value: "grasshopper", label: "Grasshoppers", icon: "🦗" },
    ],
  },
  secondaryFilters: [
    {
      key: "sizeClass",
      label: "Size",
      type: "pills",
      options: [
        { value: "tiny", label: "Tiny" },
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
    },
    {
      key: "colorPattern",
      label: "Color Pattern",
      type: "pills",
      options: [
        { value: "solid", label: "Solid" },
        { value: "striped", label: "Striped" },
        { value: "spotted", label: "Spotted" },
        { value: "banded", label: "Banded" },
        { value: "iridescent", label: "Iridescent" },
      ],
    },
  ],
  hasFlowerBrowser: false,
  browseCards: [
    {
      href: "/browse/traits",
      icon: "🦋",
      title: "Browse by Type",
      description: "Butterflies, dragonflies, bees, beetles — filter by type, size, and habitat.",
      color: "bg-forest/10 text-forest",
      examples: "Large butterflies, Spotted beetles, Meadow bees",
    },
    {
      href: "/browse/monthly",
      icon: "📅",
      title: "Monthly Field Guide",
      description: "When different insects are active each month — real observation data.",
      color: "bg-amber-100 text-amber-700",
      examples: "May emergence, July flight peak, September monarchs",
    },
  ],
};

// ============================================================
// Group config lookup
// ============================================================

const GROUP_BROWSE_CONFIGS: Record<string, GroupBrowseConfig> = {
  plants: plantConfig,
  fungi: fungusConfig,
  birds: animalConfig,
  mammals: animalConfig,
  reptiles: animalConfig,
  amphibians: animalConfig,
  insects: insectConfig,
  lichens: lichenConfig,
  arachnids: animalConfig,
  mollusks: animalConfig,
  fish: animalConfig,
  crustaceans: animalConfig,
  myriapods: animalConfig,
  cnidarians: animalConfig,
  echinoderms: animalConfig,
};

export function getGroupBrowseConfig(group: string): GroupBrowseConfig {
  return GROUP_BROWSE_CONFIGS[group] || plantConfig;
}

/** Common habitats shared across all groups */
export const COMMON_HABITATS = [
  "forest",
  "wetland",
  "meadow",
  "roadside",
  "alpine",
  "coastal",
  "garden",
  "freshwater",
  "urban",
];
