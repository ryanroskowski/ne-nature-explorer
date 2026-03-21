/**
 * Taxon group configuration for the multi-taxon pipeline.
 *
 * Each group defines the iNaturalist taxon ID, display name, and taxonomy rank
 * used to fetch species, build taxonomy trees, and organize pipeline output.
 */

export interface TaxonGroupConfig {
  /** iNaturalist taxon ID (null for composite groups like insects) */
  taxonId: number | null;
  /** Display name for the group */
  name: string;
  /** Taxonomy rank of the root taxon */
  rank: string;
  /** Label shown in the breadcrumb root (e.g. "Plants", "Birds") */
  label: string;
  /** iNaturalist iconic_taxa fallback (used when taxonId is null for broad queries) */
  iconicTaxa?: string;
  /** For composite groups: sub-taxon IDs to fetch separately */
  subgroups?: {
    taxonId: number;
    name: string;
    /** Maximum species to keep (sorted by observation count) — null = keep all */
    maxSpecies?: number;
  }[];
  /** Content generation tier strategy: "full" = all species get full content,
   *  "tiered" = top 75% full, <50 obs short, <5 obs skip */
  contentTier: "full" | "tiered";
}

export const TAXON_GROUPS: Record<string, TaxonGroupConfig> = {
  plants: {
    taxonId: 47126,
    name: "Plantae",
    rank: "kingdom",
    label: "Plants",
    iconicTaxa: "Plantae",
    contentTier: "full",
  },
  fungi: {
    taxonId: 47170,
    name: "Fungi",
    rank: "kingdom",
    label: "Fungi",
    iconicTaxa: "Fungi",
    contentTier: "tiered",
  },
  birds: {
    taxonId: 3,
    name: "Aves",
    rank: "class",
    label: "Birds",
    contentTier: "full",
  },
  mammals: {
    taxonId: 40151,
    name: "Mammalia",
    rank: "class",
    label: "Mammals",
    contentTier: "full",
  },
  reptiles: {
    taxonId: 26036,
    name: "Reptilia",
    rank: "class",
    label: "Reptiles",
    contentTier: "full",
  },
  amphibians: {
    taxonId: 20978,
    name: "Amphibia",
    rank: "class",
    label: "Amphibians",
    contentTier: "full",
  },
  insects: {
    taxonId: null,
    name: "Insects",
    rank: "mixed",
    label: "Insects",
    contentTier: "tiered",
    subgroups: [
      { taxonId: 47224, name: "Butterflies (Papilionoidea)" },
      { taxonId: 47792, name: "Dragonflies & Damselflies (Odonata)" },
      { taxonId: 630955, name: "Bees (Anthophila)" },
      { taxonId: 47651, name: "Grasshoppers & Crickets (Orthoptera)" },
      { taxonId: 47157, name: "Moths (Lepidoptera excl. butterflies)", maxSpecies: 200 },
      { taxonId: 47208, name: "Beetles (Coleoptera)", maxSpecies: 200 },
    ],
  },
  lichens: {
    taxonId: 54743,
    name: "Lichens",
    rank: "class",
    label: "Lichens",
    contentTier: "full",
  },
  arachnids: {
    taxonId: 47119,
    name: "Arachnida",
    rank: "class",
    label: "Arachnids",
    contentTier: "full",
  },
  mollusks: {
    taxonId: 47115,
    name: "Mollusca",
    rank: "phylum",
    label: "Mollusks",
    contentTier: "full",
  },
  fish: {
    taxonId: 47178,
    name: "Actinopterygii",
    rank: "class",
    label: "Fish",
    contentTier: "full",
  },
  crustaceans: {
    taxonId: 85493,
    name: "Malacostraca",
    rank: "class",
    label: "Crustaceans",
    contentTier: "full",
  },
  myriapods: {
    taxonId: null,
    name: "Myriapoda",
    rank: "mixed",
    label: "Myriapods",
    contentTier: "full",
    subgroups: [
      { taxonId: 49556, name: "Centipedes (Chilopoda)" },
      { taxonId: 47735, name: "Millipedes (Diplopoda)" },
    ],
  },
  cnidarians: {
    taxonId: 47534,
    name: "Cnidaria",
    rank: "phylum",
    label: "Cnidarians",
    contentTier: "full",
  },
  echinoderms: {
    taxonId: 47549,
    name: "Echinodermata",
    rank: "phylum",
    label: "Echinoderms",
    contentTier: "full",
  },
};

export type TaxonGroupKey = keyof typeof TAXON_GROUPS;

/** Get the pipeline output directory for a group */
export function getGroupPipelineDir(group: string): string {
  return `data/pipeline/${group}`;
}

/** Resolve a group key from CLI args */
export function resolveGroup(args: string[]): { key: string; config: TaxonGroupConfig } | null {
  const groupIdx = args.indexOf("--group");
  if (groupIdx === -1) return null;

  const groupKey = args[groupIdx + 1];
  if (!groupKey || !(groupKey in TAXON_GROUPS)) {
    const validGroups = Object.keys(TAXON_GROUPS).join(", ");
    console.error(`Invalid group: "${groupKey}". Valid groups: ${validGroups}`);
    process.exit(1);
  }

  return { key: groupKey, config: TAXON_GROUPS[groupKey] };
}
