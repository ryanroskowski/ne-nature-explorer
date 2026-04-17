import fs from "fs";
import path from "path";
import type { SpeciesData } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

// Module-level caches — the JSON data is static between deploys, so it's
// safe to cache in memory for the lifetime of the server process. First
// cold call pays the filesystem read; subsequent calls are ~instant.
let _slugsCache: string[] | null = null;
let _allSpeciesCache: SpeciesData[] | null = null;
const _speciesCache = new Map<string, SpeciesData | null>();

export function getAllSpeciesSlugs(): string[] {
  if (_slugsCache) return _slugsCache;
  const speciesDir = path.join(DATA_DIR, "species");
  if (!fs.existsSync(speciesDir)) {
    _slugsCache = [];
    return _slugsCache;
  }
  _slugsCache = fs
    .readdirSync(speciesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
  return _slugsCache;
}

export function getSpecies(slug: string): SpeciesData | null {
  if (_speciesCache.has(slug)) return _speciesCache.get(slug) ?? null;
  const filePath = path.join(DATA_DIR, "species", `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    _speciesCache.set(slug, null);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SpeciesData;
  _speciesCache.set(slug, data);
  return data;
}

export function getAllSpecies(): SpeciesData[] {
  if (_allSpeciesCache) return _allSpeciesCache;
  const slugs = getAllSpeciesSlugs();
  _allSpeciesCache = slugs
    .map((slug) => getSpecies(slug))
    .filter((s): s is SpeciesData => s !== null);
  return _allSpeciesCache;
}
