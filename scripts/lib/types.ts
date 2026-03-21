// ============================================================
// Pipeline types — used by the data-fetching and generation scripts
// ============================================================

/** Raw species record from iNaturalist species_counts endpoint */
export interface INatSpeciesCount {
  count: number;
  taxon: INatTaxon;
}

/** Taxon object as returned by iNaturalist API */
export interface INatTaxon {
  id: number;
  name: string;
  rank: string;
  rank_level: number;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  ancestor_ids?: number[];
  ancestors?: INatTaxon[];
  ancestry?: string; // pipe-separated ancestor ids e.g. "48460/1/47126/..."
  wikipedia_url?: string;
  wikipedia_summary?: string;
  observations_count?: number;
  default_photo?: INatPhoto;
  establishment_means?: {
    place?: { id: number; display_name: string };
    establishment_means: string; // "native" | "introduced" | "endemic"
  };
  is_active?: boolean;
  extinct?: boolean;
  taxon_photos?: { photo: INatPhoto }[];
}

/** Photo object from iNaturalist */
export interface INatPhoto {
  id: number;
  url: string;
  square_url?: string;
  small_url?: string;
  medium_url?: string;
  large_url?: string;
  original_url?: string;
  attribution: string;
  license_code: string;
}

/** Observation from iNaturalist with photos */
export interface INatObservation {
  id: number;
  quality_grade: string;
  photos: INatPhoto[];
  taxon?: INatTaxon;
  description?: string;
  tags?: string[];
  user?: {
    login: string;
    name?: string;
  };
}

/** iNaturalist API paginated response wrapper */
export interface INatPaginatedResponse<T> {
  total_results: number;
  page: number;
  per_page: number;
  results: T[];
}

// ============================================================
// Generated content types — output from Claude API
// ============================================================

export interface GeneratedSpeciesContent {
  nameStory: string;
  description: string;
  idTips: IdTip[];
  habitat: string;
  seasonality: SeasonalNotes;
  funFact: string;
  confusionNotes: string | null;
  contextualKnowledge: string | null;
  compareHints: string;
}

export interface IdTip {
  label: string;
  description: string;
  isPrimary?: boolean; // the single most diagnostic feature
}

export interface SeasonalNotes {
  spring: string;
  summer: string;
  fall: string;
  winter: string;
}

export interface GeneratedGroupContent {
  description: string;
  distinguishingFeatures: string;
  funFact: string;
}

// ============================================================
// Intermediate pipeline data
// ============================================================

/** Species data after fetching + enrichment, before content generation */
export interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
  rank: string;
  observationCount: number; // NE observation count
  globalObservationCount: number;
  ancestorIds: number[];
  familyName?: string;
  familyCommonName?: string;
  genusName?: string;
  genusCommonName?: string;
  orderName?: string;
  orderCommonName?: string;
  className?: string;
  classCommonName?: string;
  phylumName?: string;
  phylumCommonName?: string;
  wikipediaUrl?: string;
  wikipediaSummary?: string;
  establishmentMeans?: string; // "native" | "introduced"
  defaultPhotoUrl?: string;
}

/** Trait classification output from Stage 6 */
export interface PipelineSpeciesTraits {
  growthForm: string;
  leafType: string;
  flowerColors: string[];
  flowerShape: string;
  fruitType: string;
  habitatTypes: string[];
  bloomPeriod: string | null;
  isNative: boolean;
  seasonalHighlights: {
    spring: string[];
    summer: string[];
    fall: string[];
    winter: string[];
  };
}

/** Photo collected for a species */
export interface PipelinePhoto {
  id: number;
  url: string;
  mediumUrl: string;
  largeUrl: string;
  attribution: string;
  licenseCode: string;
  observationId: number;
  observerName: string;
}
