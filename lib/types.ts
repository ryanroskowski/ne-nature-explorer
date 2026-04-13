// ============================================================
// App types — used by the Next.js frontend
// ============================================================

/** A node in the taxonomy tree (used by the Tree of Life Explorer) */
export interface TaxonomyNode {
  id: number;
  name: string; // scientific name
  commonName: string;
  rank: TaxonRank;
  speciesCount: number; // total species under this node
  description?: string; // generated description of this group
  distinguishingFeatures?: string;
  funFact?: string;
  representativePhotoUrl?: string;
  children: TaxonomyNode[];
  slug?: string; // URL-friendly name for routing
}

export type TaxonRank =
  | "kingdom"
  | "phylum"
  | "class"
  | "order"
  | "family"
  | "genus"
  | "species"
  | "subphylum"
  | "subclass"
  | "suborder"
  | "superfamily"
  | "subfamily"
  | "tribe"
  | "subtribe";

/** Complete species page data */
export interface SpeciesData {
  slug: string;
  taxonId: number;
  group?: string; // taxon group key (e.g. "plants", "birds", "fungi")
  commonName: string;
  alternativeNames?: string[];
  scientificName: string;
  family: string;
  familyCommonName: string;
  genus: string;
  genusCommonName: string;
  order: string;
  orderCommonName: string;

  // Breadcrumb path from kingdom to species
  breadcrumb: BreadcrumbItem[];

  // Abundance
  observationCount: number;
  abundanceTier: AbundanceTier;

  // Photos
  photos: SpeciesPhoto[];

  // Generated content
  nameStory: string;
  description: string;
  idTips: {
    label: string;
    description: string;
    isPrimary?: boolean;
  }[];
  habitat: string;
  seasonality: {
    spring: string;
    summer: string;
    fall: string;
    winter: string;
  };
  funFact: string;
  confusionNotes: string | null;
  contextualKnowledge: string | null;
  compareHints: string;

  // Related species in the same genus
  relatedSpecies: RelatedSpecies[];

  // Audio recordings (birds)
  audio?: SpeciesAudio[];

  // Plant-specific badges
  bloomPeriod?: string | null;     // "spring", "early-summer", "summer", etc.
  pollinatorInfo?: string[];        // ["bees", "butterflies", "hummingbirds"] from GloBI

  // Ecological roles (insects)
  ecologicalRole?: {
    isPollinator: boolean;
    pollinatorType?: "primary" | "minor";
    isBeneficial: boolean;
    beneficialRole?: string;
    isPest: boolean;
    pestLevel?: "minor" | "major";
    pestNote?: string;
  };

  // Metadata
  isNative?: boolean;
  isInvasive?: boolean;
  establishmentMeans?: string;
  wikipediaUrl?: string;
  iNaturalistUrl: string;
  xenoCantoUrl?: string;    // Xeno-canto species page (birds only)
}

export interface BreadcrumbItem {
  label: string;
  rank: string;
  slug: string;
}

export type AbundanceTier =
  | "very-common"
  | "common"
  | "moderate"
  | "uncommon"
  | "rare";

export interface SpeciesPhoto {
  id: number;
  mediumUrl: string;
  largeUrl: string;
  attribution: string;
  licenseCode: string;
  observationUrl: string;
}

export interface SpeciesAudio {
  xenoCantoId: string;
  type: string;         // "song", "call", "alarm", "drumming"
  label?: string;       // display label (e.g. "Song 1", "Song 2", "Call")
  audioUrl: string;     // direct MP3/M4A URL
  pageUrl: string;      // source page URL
  recordist: string;
  license: string;
  quality: string;      // A, B, "iNat", etc.
  length: string;       // "0:45"
  location: string;
  sonogramUrl: string;
}

export interface RelatedSpecies {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  distinction: string; // one-line distinguishing feature
}

/** Entry in the commonality ranking */
export interface CommonalityEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyCommonName: string;
  group?: string; // taxon group key
  observationCount: number;
  abundanceTier: AbundanceTier;
  thumbnailUrl?: string;
  photos?: { mediumUrl: string }[];
}

/** Search index entry (flattened for Fuse.js) */
export interface SearchEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyCommonName: string;
  genus: string;
  group?: string; // taxon group key
  type: "species" | "genus" | "family";
}

/** Contextual knowledge article */
export interface ContextualArticle {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  content: ArticleBlock[];
  relatedSpeciesSlugs: string[];
}

export type ArticleBlock =
  | { type: "intro"; text: string }
  | { type: "section"; heading?: string; text: string }
  | { type: "tip"; text: string }
  | {
      type: "audio";
      heading?: string;
      description?: string;
      audioUrl: string;
      attribution?: string;
    }
  | {
      type: "image";
      url: string;
      alt?: string;
      caption?: string;
      attribution?: string;
    }
  | {
      type: "image-grid";
      images: {
        url: string;
        alt?: string;
        caption?: string;
        attribution?: string;
      }[];
      caption?: string;
    };

// ============================================================
// Trait classification (from AI pipeline Stage 6)
// ============================================================

// Plant-specific trait value types
export type GrowthForm = "tree" | "shrub" | "herb" | "vine" | "grass-sedge" | "fern" | "moss" | "aquatic";
export type LeafType = "needles" | "broad-deciduous" | "broad-evergreen" | "fronds" | "blades" | "scales" | "none";
export type FlowerShape = "composite" | "tubular" | "bell" | "pea-like" | "radial" | "irregular" | "catkin" | "umbel" | "spike" | "none";
export type FruitType = "cone" | "berry" | "nut-acorn" | "drupe" | "pod" | "capsule" | "winged-seed" | "achene" | "aggregate" | "spore" | "none";
export type BloomPeriod = "early-spring" | "spring" | "late-spring" | "early-summer" | "summer" | "late-summer" | "fall";

export type TraitSchemaType = "plant" | "animal" | "fungus" | "lichen";

/**
 * Polymorphic species traits — shared base with schema-specific optional fields.
 * All groups share: habitatTypes, isNative, seasonalHighlights.
 * _schemaType identifies which set of trait fields is populated.
 * Index signature allows additional fields from any schema.
 */
export interface SpeciesTraits {
  _schemaType?: TraitSchemaType;

  // Shared across all groups
  habitatTypes: string[];
  isNative: boolean;
  seasonalHighlights: {
    spring: string[];
    summer: string[];
    fall: string[];
    winter: string[];
  };

  // Plant-specific (present when _schemaType is "plant" or undefined)
  growthForm?: GrowthForm;
  leafType?: LeafType;
  flowerColors?: string[];
  flowerShape?: FlowerShape;
  fruitType?: FruitType;
  bloomPeriod?: BloomPeriod | null;

  // Animal-specific (present when _schemaType is "animal")
  bodyType?: string;
  sizeClass?: string;
  activityPattern?: string;
  dietType?: string;
  seasonalPresence?: string;
  colorPattern?: string;

  // Fungus-specific (present when _schemaType is "fungus")
  fruitingBodyType?: string;
  capShape?: string;
  sporeStructure?: string;
  colorPrimary?: string;
  substrate?: string;
  fruitingSeason?: string;
  isEdible?: string;

  // Lichen-specific fields reuse: growthForm, colorPrimary, substrate

  // Allow additional trait fields from any schema
  [key: string]: any;
}

/** Browse index entry (compact, for client-side filtering) */
export interface BrowseEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyCommonName: string;
  group?: string; // taxon group key
  abundanceTier: AbundanceTier;
  thumbnailUrl?: string;
  photos?: { mediumUrl: string }[];
  traits: SpeciesTraits;
}

/** Group metadata (from data/groups.json) */
export interface GroupInfo {
  key: string;
  label: string;
  icon: string;
  speciesCount: number;
  status: "active" | "coming";
}

/** Seasonal guide — pre-computed monthly highlights */
export interface SeasonalGuide {
  months: Record<string, MonthGuide>;
}

export interface MonthGuide {
  season: string;
  highlights: SeasonalHighlight[];
}

export interface SeasonalHighlight {
  feature: string;
  description: string;
  icon: string;
  species: SeasonalSpeciesEntry[];
}

export interface SeasonalSpeciesEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  abundanceTier: AbundanceTier;
  note: string;
}

/** Monthly field guide — real observation data from iNaturalist by month */
export interface MonthlyGuide {
  generatedAt: string;
  groups: Record<string, MonthlyGroupData>;
}

export interface MonthlyGroupData {
  months: Record<string, MonthlyMonthData>;
}

export interface MonthlyMonthData {
  totalObservations: number;
  species: MonthlySpeciesEntry[];
}

export interface MonthlySpeciesEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  abundanceTier: AbundanceTier;
  observationCount: number;
  note: string;
  isNewArrival: boolean;
  isDepartingSoon: boolean;
}

// ============================================================
// Nature Map — nature areas with species data
// ============================================================

/** A nature area (park, reservation, conservation land) */
export interface NatureArea {
  id: string;
  name: string;
  state: string; // two-letter state code (e.g., "MA", "VT")
  owner: string;
  ownerType: "state" | "nonprofit" | "municipal" | "federal" | "other";
  purpose: string;
  acreage: number;
  publicAccess: "yes" | "limited";
  centroid: [number, number]; // [lng, lat]
  bbox: [number, number, number, number]; // [swLng, swLat, neLng, neLat]
  geometry?: GeoJSON.Geometry; // simplified polygon for map display
}

/** Species found at a nature area */
export interface AreaSpeciesEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  group: string;
  observationCount: number;
  uniquenessScore: number; // 0-1: how unique to this area vs others
}

/** Per-area species data with computed highlights */
export interface AreaSpeciesData {
  areaId: string;
  speciesFound: number;
  highlights: AreaSpeciesEntry[]; // top unique species (across all groups)
  common: AreaSpeciesEntry[]; // commonly found species (across all groups)
  groupBreakdown: Record<string, number>; // { plants: 45, birds: 30, ... }
  groupHighlights?: Record<string, AreaSpeciesEntry[]>; // per-group top species
}

/** Full nature areas dataset */
export interface NatureAreasData {
  generatedAt: string;
  region: string;
  states: string[];
  totalAreas: number;
  areas: NatureArea[];
}

/** Full area species dataset */
export interface NatureAreasSpeciesData {
  generatedAt: string;
  areaSpecies: Record<string, AreaSpeciesData>; // keyed by area id
}

/** Lightweight species index — just counts for map filtering (loaded at page init) */
export interface SpeciesIndexData {
  generatedAt: string;
  areaSpecies: Record<string, SpeciesIndexEntry>;
}

export interface SpeciesIndexEntry {
  speciesFound: number;
  groupBreakdown: Record<string, number>;
}
