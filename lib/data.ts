import fs from "fs";
import path from "path";
import type {
  SpeciesData,
  TaxonomyNode,
  CommonalityEntry,
  SearchEntry,
  ContextualArticle,
  BrowseEntry,
  SeasonalGuide,
  MonthlyGuide,
  GroupInfo,
  NatureAreasData,
  NatureAreasSpeciesData,
  SpeciesIndexData,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

// ============================================================
// Species (shared across all groups — slugs are globally unique)
// ============================================================

export function getAllSpeciesSlugs(): string[] {
  const speciesDir = path.join(DATA_DIR, "species");
  if (!fs.existsSync(speciesDir)) return [];
  return fs
    .readdirSync(speciesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

export function getSpecies(slug: string): SpeciesData | null {
  const filePath = path.join(DATA_DIR, "species", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getAllSpecies(): SpeciesData[] {
  const slugs = getAllSpeciesSlugs();
  return slugs
    .map((slug) => getSpecies(slug))
    .filter((s): s is SpeciesData => s !== null);
}

// ============================================================
// Group-aware data accessors
// ============================================================

export function getAllTaxonomyTrees(): { group: GroupInfo; tree: TaxonomyNode }[] {
  const groups = getAvailableGroups().filter((g) => g.status === "active");
  const results: { group: GroupInfo; tree: TaxonomyNode }[] = [];
  for (const g of groups) {
    const tree = getTaxonomyTree(g.key);
    if (tree) results.push({ group: g, tree });
  }
  return results;
}

export function getTaxonomyTree(group: string = "plants"): TaxonomyNode | null {
  // Try group-suffixed file first, fall back to legacy taxonomy.json
  const groupPath = path.join(DATA_DIR, `taxonomy-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  // Legacy fallback (for existing plant data before migration)
  if (group === "plants") {
    const legacyPath = path.join(DATA_DIR, "taxonomy.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }
  return null;
}

export function getCommonality(group: string = "plants"): CommonalityEntry[] {
  // Try group-suffixed file first, fall back to legacy
  const groupPath = path.join(DATA_DIR, `commonality-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  // Legacy fallback
  if (group === "plants") {
    const legacyPath = path.join(DATA_DIR, "commonality.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }
  return [];
}

export function getSearchIndex(group?: string): SearchEntry[] {
  if (group) {
    // Load specific group's search index
    const groupPath = path.join(DATA_DIR, `search-index-${group}.json`);
    if (fs.existsSync(groupPath)) {
      return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
    }
    // Legacy fallback for plants
    if (group === "plants") {
      const legacyPath = path.join(DATA_DIR, "search-index.json");
      if (fs.existsSync(legacyPath)) {
        return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
      }
    }
    return [];
  }

  // No group specified: merge all available search indexes
  const allEntries: SearchEntry[] = [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("search-index-") && f.endsWith(".json"));

  if (files.length > 0) {
    for (const file of files) {
      const entries: SearchEntry[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      allEntries.push(...entries);
    }
  } else {
    // Legacy fallback: single search-index.json without group field
    const legacyPath = path.join(DATA_DIR, "search-index.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }

  return allEntries;
}

export function getBrowseIndex(group: string = "plants"): BrowseEntry[] {
  const groupPath = path.join(DATA_DIR, `browse-index-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  // Legacy fallback
  if (group === "plants") {
    const legacyPath = path.join(DATA_DIR, "browse-index.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }
  return [];
}

export function getSeasonalGuide(group: string = "plants"): SeasonalGuide | null {
  const groupPath = path.join(DATA_DIR, `seasonal-guide-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  // Legacy fallback
  if (group === "plants") {
    const legacyPath = path.join(DATA_DIR, "seasonal-guide.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }
  return null;
}

// ============================================================
// Group metadata
// ============================================================

export function getAvailableGroups(): GroupInfo[] {
  const groupsPath = path.join(DATA_DIR, "groups.json");
  if (!fs.existsSync(groupsPath)) {
    // No groups.json yet — return plants as default active group
    return [{ key: "plants", label: "Plants", icon: "🌿", speciesCount: 0, status: "active" }];
  }
  const groups: Record<string, GroupInfo> = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));
  return Object.values(groups);
}

export function getGroupInfo(group: string): GroupInfo | null {
  const groups = getAvailableGroups();
  return groups.find((g) => g.key === group) || null;
}

// ============================================================
// Monthly field guide (cross-group, real iNaturalist data)
// ============================================================

export function getMonthlyGuide(): MonthlyGuide | null {
  const filePath = path.join(DATA_DIR, "monthly-guide.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ============================================================
// Nature Map — areas with species data
// ============================================================

export function getNatureAreas(): NatureAreasData | null {
  const filePath = path.join(DATA_DIR, "nature-areas.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getNatureAreasSpecies(): NatureAreasSpeciesData | null {
  const filePath = path.join(DATA_DIR, "nature-areas-species.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getSpeciesIndex(): SpeciesIndexData | null {
  const filePath = path.join(DATA_DIR, "nature-areas-species-index.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ============================================================
// Contextual articles (not group-specific for now)
// ============================================================

export function getContextualArticles(): ContextualArticle[] {
  const filePath = path.join(DATA_DIR, "contextual-knowledge.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getContextualArticle(slug: string): ContextualArticle | null {
  const articles = getContextualArticles();
  return articles.find((a) => a.slug === slug) || null;
}

/** Find articles that mention a given species slug */
export function getArticlesForSpecies(speciesSlug: string): ContextualArticle[] {
  const articles = getContextualArticles();
  return articles.filter((a) => a.relatedSpeciesSlugs.includes(speciesSlug));
}
