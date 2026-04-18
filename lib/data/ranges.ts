import fs from "fs";
import path from "path";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

/** The shape of data/ranges/{slug}.json — mirrors scripts/lib/range-maps.ts RangeData. */
export interface SpeciesRange {
  slug: string;
  scientificName: string;
  source: "littles" | "inat-hull";
  attribution: string;
  license: string;
  bbox: [number, number, number, number];
  observationCount?: number;
  polygon: Feature<Polygon | MultiPolygon>;
}

/** The shape of data/basemap/na-basemap.json — mirrors scripts/build-basemap.ts output. */
export interface Basemap {
  countries: FeatureCollection<Polygon | MultiPolygon>;
  states: FeatureCollection<Polygon | MultiPolygon>;
  neStates: FeatureCollection<Polygon | MultiPolygon>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const RANGES_DIR = path.join(DATA_DIR, "ranges");
const BASEMAP_FILE = path.join(DATA_DIR, "basemap", "na-basemap.json");

// Module-level caches — data is static between deploys.
const _rangeCache = new Map<string, SpeciesRange | null>();
let _basemapCache: Basemap | null = null;

export function getRangeForSpecies(slug: string): SpeciesRange | null {
  if (_rangeCache.has(slug)) return _rangeCache.get(slug) ?? null;
  const file = path.join(RANGES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) {
    _rangeCache.set(slug, null);
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as SpeciesRange;
    _rangeCache.set(slug, data);
    return data;
  } catch {
    _rangeCache.set(slug, null);
    return null;
  }
}

export function getBasemap(): Basemap | null {
  if (_basemapCache) return _basemapCache;
  if (!fs.existsSync(BASEMAP_FILE)) return null;
  try {
    _basemapCache = JSON.parse(fs.readFileSync(BASEMAP_FILE, "utf-8")) as Basemap;
    return _basemapCache;
  } catch {
    return null;
  }
}
