/**
 * Range-map helpers: source lookup, iNaturalist hull computation, and
 * output formatting for the range-maps pipeline stage.
 *
 * Two data sources are supported:
 *   1. Little's Atlas (trees) — pre-converted GeoJSON in
 *      .cache/ranges-sources/USTreeAtlas/geojson/*.geojson
 *      indexed by Little_datatable.csv (Latin Name → 8-char code)
 *   2. iNaturalist observations → concave hull (everything else)
 */

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import concaveman from "concaveman";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { getCached, setCache } from "./cache";

// ---------- Paths ----------

const USTA_DIR = path.join(
  process.cwd(),
  ".cache",
  "ranges-sources",
  "USTreeAtlas"
);
const USTA_GEOJSON_DIR = path.join(USTA_DIR, "geojson");
const USTA_CSV = path.join(USTA_DIR, "Little_datatable.csv");

// ---------- Types ----------

export type RangeSource = "littles" | "inat-hull";

/** Per-species range data written to data/ranges/{slug}.json */
export interface RangeData {
  slug: string;
  scientificName: string;
  source: RangeSource;
  /** Human-readable attribution / citation */
  attribution: string;
  /** License identifier */
  license: string;
  /** Bounding box [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** Number of observations used (inat-hull only) */
  observationCount?: number;
  /** Simplified polygon in WGS84 */
  polygon: Feature<Polygon | MultiPolygon>;
}

// ---------- Little's (trees) ----------

let _littlesIndex: Map<string, string> | null = null;

/**
 * Load Little's species → file code mapping from the CSV.
 * Returns a Map keyed by lowercase "Genus species" → 8-char code like "pinustro".
 */
export function loadLittlesIndex(): Map<string, string> {
  if (_littlesIndex) return _littlesIndex;
  const idx = new Map<string, string>();
  if (!fs.existsSync(USTA_CSV)) {
    console.warn(`  [warn] Little's CSV not found at ${USTA_CSV}`);
    _littlesIndex = idx;
    return idx;
  }
  const raw = fs.readFileSync(USTA_CSV, "utf-8");
  const lines = raw.split(/\r?\n/);
  // Header: Latin Name,Common Name,Reference,Original Map No(s).,SHP/*
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // CSV may contain quoted fields — do a minimal parse good enough here
    const fields = parseCsvLine(line);
    const latinName = (fields[0] ?? "").trim();
    const code = (fields[4] ?? "").trim().toLowerCase();
    if (latinName && code) {
      idx.set(latinName.toLowerCase(), code);
    }
  }
  _littlesIndex = idx;
  return idx;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Try to load a Little's polygon for a species scientific name.
 * Returns null if the species isn't in the atlas.
 */
export function getLittlesPolygon(
  scientificName: string
): Feature<Polygon | MultiPolygon> | null {
  const idx = loadLittlesIndex();
  const code = idx.get(scientificName.toLowerCase());
  if (!code) return null;
  const file = path.join(USTA_GEOJSON_DIR, `${code}.geojson`);
  if (!fs.existsSync(file)) return null;
  try {
    const fc = JSON.parse(fs.readFileSync(file, "utf-8")) as FeatureCollection;
    if (!fc.features || fc.features.length === 0) return null;
    // Merge all polygon features into a single MultiPolygon feature.
    const polys: (Polygon | MultiPolygon)[] = [];
    for (const f of fc.features) {
      if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
        polys.push(f.geometry);
      }
    }
    if (polys.length === 0) return null;
    const geom: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: polys.flatMap((g) =>
        g.type === "Polygon" ? [g.coordinates] : g.coordinates
      ),
    };
    return {
      type: "Feature",
      properties: {},
      geometry: geom,
    };
  } catch (err) {
    console.warn(`  [warn] Failed to read ${file}:`, (err as Error).message);
    return null;
  }
}

// ---------- iNaturalist hull ----------

const INAT_BASE = "https://api.inaturalist.org/v1";

/**
 * Bounding box used to clip iNaturalist observations to North America
 * (plus Alaska, Central America, the Caribbean, and a margin) before
 * computing the concave hull.
 *
 * Without this clip, species like Pieris japonica — native to Japan
 * but widely planted across North America and Europe — end up with a
 * concave hull spanning three continents. When that hull is drawn on
 * the Albers-NA projection, long straight edges slice across the
 * Pacific and Atlantic, producing obviously wrong green blobs in the
 * ocean. Since the map only shows NA, clipping to NA at the point
 * stage also produces the polygon users actually want to see: where
 * the species occurs in (and near) New England/North America.
 *
 * [minLng, minLat, maxLng, maxLat]
 */
export const NA_POINT_CLIP: [number, number, number, number] = [
  -170, 5, -50, 75,
];

/** Keep only points inside the NA clip bbox. */
export function clipPointsToNA(
  points: Array<[number, number]>
): Array<[number, number]> {
  const [minLng, minLat, maxLng, maxLat] = NA_POINT_CLIP;
  return points.filter(
    ([lng, lat]) =>
      lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
  );
}

interface INatObservationPoint {
  id: number;
  geojson?: { type: "Point"; coordinates: [number, number] };
  location?: string; // "lat,lng"
}

interface INatObservationsResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatObservationPoint[];
}

let lastINatReq = 0;
const INAT_MIN_INTERVAL_MS = 1500;

async function inatRateLimit(): Promise<void> {
  const now = Date.now();
  const wait = INAT_MIN_INTERVAL_MS - (now - lastINatReq);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastINatReq = Date.now();
}

/**
 * Fetch a sample of geolocated iNat observations for a taxon.
 * Returns an array of [lng, lat] pairs. Uses cache.
 */
export async function fetchObservationPoints(
  taxonId: number,
  maxPoints = 500
): Promise<Array<[number, number]>> {
  const cached = getCached<Array<[number, number]>>("range-inat", String(taxonId));
  if (cached) return cached;

  const points: Array<[number, number]> = [];
  const perPage = 200;
  const maxPages = Math.ceil(maxPoints / perPage);

  for (let page = 1; page <= maxPages; page++) {
    await inatRateLimit();
    const url = new URL(`${INAT_BASE}/observations`);
    url.searchParams.set("taxon_id", String(taxonId));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("geo", "true");
    url.searchParams.set("verifiable", "true");
    url.searchParams.set("acc_below", "10000"); // coord accuracy < 10 km
    // Research-grade gives cleaner data but is too restrictive for rare
    // species. Verifiable+accuracy filter is a good middle ground.

    let data: INatObservationsResponse;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 30_000));
          page--;
          continue;
        }
        console.warn(`  [warn] iNat ${res.status} for taxon ${taxonId}`);
        break;
      }
      data = (await res.json()) as INatObservationsResponse;
    } catch (err) {
      console.warn(
        `  [warn] iNat fetch error for taxon ${taxonId}:`,
        (err as Error).message
      );
      break;
    }

    for (const obs of data.results) {
      if (obs.geojson?.coordinates) {
        points.push([obs.geojson.coordinates[0], obs.geojson.coordinates[1]]);
      } else if (obs.location) {
        const [lat, lng] = obs.location.split(",").map((s) => Number(s.trim()));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          points.push([lng, lat]);
        }
      }
      if (points.length >= maxPoints) break;
    }

    if (points.length >= maxPoints) break;
    if (data.results.length < perPage) break; // no more pages
  }

  setCache("range-inat", String(taxonId), points);
  return points;
}

/**
 * Compute a concave-hull polygon from observation points.
 *
 * Returns null if there are too few points for a meaningful polygon
 * (< 4). Outliers are filtered via an IQR distance clip from the
 * centroid before hulling, to kill stray observations in the middle
 * of an ocean or on another continent.
 */
export function computeHull(
  points: Array<[number, number]>,
  concavity = 2.5
): Feature<Polygon> | null {
  if (points.length < 4) return null;

  // Deduplicate points (iNat sometimes returns cluster centroids)
  const seen = new Set<string>();
  const unique: Array<[number, number]> = [];
  for (const [x, y] of points) {
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([x, y]);
  }
  if (unique.length < 4) return null;

  // Filter obvious outliers: compute distances from centroid and drop
  // points beyond Q3 + 3×IQR. This is robust to multi-modal distributions.
  const cx = unique.reduce((s, p) => s + p[0], 0) / unique.length;
  const cy = unique.reduce((s, p) => s + p[1], 0) / unique.length;
  const dists = unique
    .map(([x, y], i) => ({ i, d: Math.hypot(x - cx, y - cy) }))
    .sort((a, b) => a.d - b.d);
  const q1 = dists[Math.floor(dists.length * 0.25)]?.d ?? 0;
  const q3 = dists[Math.floor(dists.length * 0.75)]?.d ?? 0;
  const iqr = q3 - q1;
  const cutoff = q3 + 3 * iqr;
  const kept = dists.filter((d) => d.d <= cutoff).map((d) => unique[d.i]);
  if (kept.length < 4) return null;

  // concaveman returns an array of [x, y] pairs (closed ring)
  const ring = concaveman(kept, concavity) as Array<[number, number]>;
  if (ring.length < 4) return null;

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

// ---------- Common simplification / bbox ----------

/**
 * Simplify a polygon feature and compute its bounding box.
 * Target size is controlled by tolerance (degrees).
 */
export function finalizePolygon(
  feature: Feature<Polygon | MultiPolygon>,
  tolerance = 0.02
): { polygon: Feature<Polygon | MultiPolygon>; bbox: [number, number, number, number] } {
  let simplified: Feature<Polygon | MultiPolygon> = feature;
  try {
    simplified = turf.simplify(feature, {
      tolerance,
      highQuality: false,
    }) as Feature<Polygon | MultiPolygon>;
  } catch {
    // keep original
  }
  const bboxArr = turf.bbox(simplified) as [number, number, number, number];
  return { polygon: simplified, bbox: bboxArr };
}

/** True if species group key belongs to a plant/tree lineage we try Little's on. */
export function shouldTryLittles(group: string | undefined): boolean {
  // Little's only covers NA trees — it's a small superset of "trees"
  // (a few shrubs). We always try it for plants and fall back to iNat
  // when the species isn't in the atlas.
  return group === "plants";
}
