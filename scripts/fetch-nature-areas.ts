/**
 * Fetch nature areas and species data from iNaturalist.
 *
 * Data sources:
 *   MA  → MassGIS Protected & Recreational OpenSpace (best parcel coverage)
 *   CT, ME, NH, RI, VT → PAD-US Management Areas (USGS)
 *
 * Stage 1: Fetch protected area polygons per state
 * Stage 2: Group/merge parcels by name, simplify geometries
 * Stage 3: Query iNaturalist species_counts per area bounding box
 * Stage 4: Compute uniqueness scores and write output
 *
 * Usage: npx tsx scripts/fetch-nature-areas.ts [--skip-species] [--state=MA]
 *
 * API calls: ~1000-5000 iNaturalist calls for species data (resume-safe via cache)
 * Cost: $0 (both APIs are free)
 */

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import dotenv from "dotenv";
dotenv.config({ override: true });

const DATA_DIR = path.join(process.cwd(), "data");
const SPECIES_DIR = path.join(DATA_DIR, "species");
const CACHE_DIR = path.join(process.cwd(), ".cache", "nature-areas");

// MassGIS ArcGIS Feature Service (MA only)
const MASSGIS_BASE =
  "https://gis.eea.mass.gov/server/rest/services/Protected_and_Recreational_OpenSpace_Polygons/FeatureServer/0/query";

// State GIS endpoints (each state has its own conservation lands portal)
const STATE_GIS: Record<string, { url: string; pageSize: number }> = {
  CT: {
    url: "https://services1.arcgis.com/FjPcSmEFuDYlIdKC/ArcGIS/rest/services/2011_Protected_Open_Space_Mapping/FeatureServer/0/query",
    pageSize: 1000,
  },
  NH: {
    url: "https://nhgeodata.unh.edu/hosting/rest/services/Hosted/EC_Conservation/FeatureServer/6/query",
    pageSize: 2000,
  },
  ME: {
    url: "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Conserved_Lands_All/FeatureServer/0/query",
    pageSize: 2000,
  },
  RI_STATE: {
    url: "https://risegis.ri.gov/hosting/rest/services/RIDEM/Conserved_Land_in_RI_v2/FeatureServer/3/query",
    pageSize: 1000,
  },
  RI_LOCAL: {
    url: "https://risegis.ri.gov/hosting/rest/services/RIDEM/Conserved_Land_in_RI_v2/FeatureServer/4/query",
    pageSize: 1000,
  },
  VT: {
    url: "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_PROTECTEDLND_poly_SP_v2/FeatureServer/0/query",
    pageSize: 2000,
  },
};

// iNaturalist
const INAT_BASE = "https://api.inaturalist.org/v1";

// New England states
const NE_STATES = ["CT", "MA", "ME", "NH", "RI", "VT"] as const;
type NEState = (typeof NE_STATES)[number];

const STATE_NAMES: Record<NEState, string> = {
  CT: "Connecticut",
  MA: "Massachusetts",
  ME: "Maine",
  NH: "New Hampshire",
  RI: "Rhode Island",
  VT: "Vermont",
};

// Minimum acreage thresholds
const MIN_ACRES = 25;
const MIN_ACRES_SANCTUARIES = 3;
const MASSGIS_PAGE_SIZE = 1000;
// Simplification tolerance for geometry (in degrees, ~0.001 ≈ 100m)
const SIMPLIFICATION_TOLERANCE = 0.001;

// ============================================================
// Utility functions
// ============================================================

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCached<T>(key: string): T | null {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      fs.unlinkSync(filePath);
      return null;
    }
  }
  return null;
}

function setCache(key: string, data: any) {
  ensureDir(CACHE_DIR);
  fs.writeFileSync(
    path.join(CACHE_DIR, `${key}.json`),
    JSON.stringify(data),
    "utf-8"
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries = 6,
  delayMs = 2000
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        // Longer backoff: 2s, 4s, 8s, 16s, 32s, 60s, 60s
        const wait = Math.min(delayMs * Math.pow(2, i), 60000);
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp;
    } catch (err: any) {
      if (i === retries) throw err;
      const wait = Math.min(delayMs * Math.pow(2, i), 60000);
      console.log(`  Retry ${i + 1}/${retries}: ${err.message}, waiting ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
  throw new Error("Unreachable");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractCoords(geometry: GeoJSON.Geometry): number[][] {
  const coords: number[][] = [];
  function walk(arr: any) {
    if (typeof arr[0] === "number") {
      coords.push(arr as number[]);
    } else {
      for (const item of arr) walk(item);
    }
  }
  if ("coordinates" in geometry) {
    walk(geometry.coordinates);
  }
  return coords;
}

function computeCentroid(
  bbox: [number, number, number, number]
): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

// ============================================================
// Types
// ============================================================

/** Unified feature type used after fetching from either source */
interface UnifiedFeature {
  type: "Feature";
  properties: {
    name: string | null;
    owner: string;
    ownerType: string; // normalized codes: FED, STAT, LOC, NGO, etc.
    purpose: string;
    acres: number;
    publicAccess: string; // "yes" or "limited"
  };
  geometry: GeoJSON.Geometry | null;
}

interface MergedArea {
  id: string;
  name: string;
  state: NEState;
  owner: string;
  ownerType: "state" | "nonprofit" | "municipal" | "federal" | "other";
  purpose: string;
  acreage: number;
  publicAccess: "yes" | "limited";
  centroid: [number, number];
  bbox: [number, number, number, number];
  geometry: GeoJSON.Geometry | null;
  parcelCount: number;
}

interface AreaSpeciesEntry {
  slug: string;
  commonName: string;
  scientificName: string;
  thumbnailUrl?: string;
  group: string;
  observationCount: number;
  uniquenessScore: number;
}

// ============================================================
// Stage 1a: Fetch MassGIS data (MA only)
// ============================================================

async function fetchMassGISPaginated(
  whereClause: string,
  label: string
): Promise<any[]> {
  const features: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      where: whereClause,
      outFields:
        "SITE_NAME,FEE_OWNER,OWNER_TYPE,PUB_ACCESS,GIS_ACRES,PRIM_PURP",
      outSR: "4326",
      f: "geojson",
      resultOffset: offset.toString(),
      resultRecordCount: MASSGIS_PAGE_SIZE.toString(),
      maxAllowableOffset: SIMPLIFICATION_TOLERANCE.toString(),
    });

    const url = `${MASSGIS_BASE}?${params}`;
    console.log(`  [${label}] Fetching offset ${offset}...`);

    const resp = await fetchWithRetry(url);
    const data = await resp.json();

    if (data.features && data.features.length > 0) {
      features.push(...data.features);
      offset += data.features.length;
      hasMore =
        data.properties?.exceededTransferLimit ||
        data.exceededTransferLimit ||
        false;
    } else {
      hasMore = false;
    }

    await sleep(500);
  }

  console.log(`  [${label}] Fetched ${features.length} features`);
  return features;
}

function massGISOwnerType(code: string | null): string {
  switch (code) {
    case "S":
      return "STAT";
    case "F":
      return "FED";
    case "M":
    case "C":
    case "D":
      return "LOC";
    case "N":
      return "NGO";
    default:
      return "UNK";
  }
}

function massGISPurpose(code: string | null): string {
  switch (code) {
    case "R":
      return "recreation";
    case "C":
      return "conservation";
    case "B":
      return "recreation";
    case "W":
      return "water-supply";
    case "A":
      return "agriculture";
    case "H":
      return "historic";
    default:
      return "conservation";
  }
}

async function fetchMassGISAreas(): Promise<UnifiedFeature[]> {
  const cached = getCached<UnifiedFeature[]>("massgis_unified_v3");
  if (cached) {
    console.log(`  Using cached MassGIS data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching MassGIS OpenSpace data...");

  // Main query: all public areas >= 25 acres
  const mainFeatures = await fetchMassGISPaginated(
    `(PUB_ACCESS='Y' OR PUB_ACCESS='L') AND GIS_ACRES>${MIN_ACRES}`,
    "MA main"
  );

  // Supplemental: small sanctuaries/reserves (3+ acres)
  const sanctuaryFeatures = await fetchMassGISPaginated(
    `(PUB_ACCESS='Y' OR PUB_ACCESS='L') AND GIS_ACRES>=${MIN_ACRES_SANCTUARIES} AND GIS_ACRES<${MIN_ACRES} AND (SITE_NAME LIKE '%Sanctuary%' OR SITE_NAME LIKE '%Wildlife%' OR SITE_NAME LIKE '%Nature%' OR SITE_NAME LIKE '%Preserve%' OR SITE_NAME LIKE '%Reserve%' OR SITE_NAME LIKE '%Audubon%' OR SITE_NAME LIKE '%Conservation%' OR SITE_NAME LIKE '%Pond%' OR SITE_NAME LIKE '%Wetland%' OR SITE_NAME LIKE '%Marsh%')`,
    "MA sanctuaries"
  );

  const allRaw = [...mainFeatures, ...sanctuaryFeatures];
  console.log(
    `  Total for MA: ${allRaw.length} features (${mainFeatures.length} main + ${sanctuaryFeatures.length} sanctuaries)`
  );

  // Normalize to UnifiedFeature
  const unified: UnifiedFeature[] = allRaw
    .filter((f: any) => f.geometry)
    .map((f: any) => ({
      type: "Feature" as const,
      properties: {
        name: f.properties.SITE_NAME?.trim() || null,
        owner: f.properties.FEE_OWNER?.trim() || "Unknown",
        ownerType: massGISOwnerType(f.properties.OWNER_TYPE),
        purpose: massGISPurpose(f.properties.PRIM_PURP),
        acres: f.properties.GIS_ACRES || 0,
        publicAccess: f.properties.PUB_ACCESS === "Y" ? "yes" : "limited",
      },
      geometry: f.geometry,
    }));

  setCache("massgis_unified_v3", unified);
  return unified;
}

// ============================================================
// Stage 1b: Fetch state-specific conservation land data
// ============================================================

/** Generic ArcGIS paginated fetch — works for any state endpoint */
async function fetchStateGIS(
  baseUrl: string,
  whereClause: string,
  outFields: string,
  label: string,
  pageSize: number
): Promise<any[]> {
  const features: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      where: whereClause,
      outFields,
      outSR: "4326",
      f: "geojson",
      resultOffset: offset.toString(),
      resultRecordCount: pageSize.toString(),
      maxAllowableOffset: SIMPLIFICATION_TOLERANCE.toString(),
    });

    const url = `${baseUrl}?${params}`;
    console.log(`  [${label}] Fetching offset ${offset}...`);

    const resp = await fetchWithRetry(url);
    const data = await resp.json();

    if (data.features && data.features.length > 0) {
      features.push(...data.features);
      offset += data.features.length;
      hasMore =
        data.properties?.exceededTransferLimit ||
        data.exceededTransferLimit ||
        false;
    } else {
      hasMore = false;
    }

    await sleep(500);
  }

  console.log(`  [${label}] Fetched ${features.length} features`);
  return features;
}

// --- Connecticut (CT DEEP) ---
async function fetchCTAreas(): Promise<UnifiedFeature[]> {
  const cacheKey = "ct_deep_unified_v1";
  const cached = getCached<UnifiedFeature[]>(cacheKey);
  if (cached) {
    console.log(`  Using cached CT DEEP data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching CT DEEP Protected Open Space...");
  const gis = STATE_GIS.CT;
  const allRaw = await fetchStateGIS(
    gis.url,
    `AREA_GIS>=${MIN_ACRES_SANCTUARIES}`,
    "OFFIC_NAME,GRANTEE,OS_TYPE,AREA_GIS",
    "CT",
    gis.pageSize
  );

  console.log(`  Total for CT: ${allRaw.length} features`);

  const unified: UnifiedFeature[] = allRaw
    .filter((f: any) => f.geometry)
    .map((f: any) => {
      const p = f.properties;
      const osType = (p.OS_TYPE || "").toLowerCase();
      let ownerType = "UNK";
      if (osType.includes("state")) ownerType = "STAT";
      else if (osType.includes("federal")) ownerType = "FED";
      else if (osType.includes("municipal")) ownerType = "LOC";
      else if (osType.includes("land trust") || osType.includes("private"))
        ownerType = "NGO";
      else if (osType.includes("water") || osType.includes("utility"))
        ownerType = "LOC";

      return {
        type: "Feature" as const,
        properties: {
          name: p.OFFIC_NAME?.trim() === "Unknown" ? null : p.OFFIC_NAME?.trim() || null,
          owner: p.GRANTEE?.trim() || "Unknown",
          ownerType,
          purpose: "conservation",
          acres: p.AREA_GIS || 0,
          publicAccess: "yes",
        },
        geometry: f.geometry,
      };
    });

  setCache(cacheKey, unified);
  return unified;
}

// --- New Hampshire (NH GRANIT) ---
async function fetchNHAreas(): Promise<UnifiedFeature[]> {
  const cacheKey = "nh_granit_unified_v1";
  const cached = getCached<UnifiedFeature[]>(cacheKey);
  if (cached) {
    console.log(`  Using cached NH GRANIT data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching NH GRANIT Conservation/Public Lands...");
  const gis = STATE_GIS.NH;
  // ownertype: 1=Municipal, 2=Federal, 3=State, 4=Other Public, 5=Private, 6=County
  // access: 1=Public, 2-4=Limited, 5=Unknown
  // pptype: FO=Fee, CE=Easement, etc.
  // level_: 1=Permanent conservation, 2=Unofficial, 3=Water supply, 4=Developed
  const allRaw = await fetchStateGIS(
    gis.url,
    `rsize>=${MIN_ACRES_SANCTUARIES} AND access IN (1,2,3,4,5) AND level_ IN ('1','2','3')`,
    "name,p_name,pptype,ppagency,ownertype,rsize,access",
    "NH",
    gis.pageSize
  );

  console.log(`  Total for NH: ${allRaw.length} features`);

  const unified: UnifiedFeature[] = allRaw
    .filter((f: any) => f.geometry)
    .map((f: any) => {
      const p = f.properties;
      // Map ownertype codes
      let ownerType = "UNK";
      switch (p.ownertype) {
        case 1: ownerType = "LOC"; break;
        case 2: ownerType = "FED"; break;
        case 3: ownerType = "STAT"; break;
        case 4: ownerType = "LOC"; break; // other public/quasi-public
        case 5: ownerType = "NGO"; break; // private conservation
        case 6: ownerType = "LOC"; break; // county
      }

      return {
        type: "Feature" as const,
        properties: {
          name: p.name?.trim() || p.p_name?.trim() || null,
          owner: "Unknown", // ppagency is a numeric code
          ownerType,
          purpose: "conservation",
          acres: p.rsize || 0,
          publicAccess: p.access === 1 ? "yes" : "limited",
        },
        geometry: f.geometry,
      };
    });

  setCache(cacheKey, unified);
  return unified;
}

// --- Maine (ACF Conserved Lands) ---
async function fetchMEAreas(): Promise<UnifiedFeature[]> {
  const cacheKey = "me_acf_unified_v1";
  const cached = getCached<UnifiedFeature[]>(cacheKey);
  if (cached) {
    console.log(`  Using cached ME ACF data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching Maine Conserved Lands...");
  const gis = STATE_GIS.ME;
  // PUB_ACCESS is free text: "Allowed..." = public, "Not allowed"/"No public" = exclude
  const allRaw = await fetchStateGIS(
    gis.url,
    `CALC_AC>=${MIN_ACRES_SANCTUARIES} AND PUB_ACCESS NOT IN ('Not allowed','No public access','Not allowed - by law, for safety reasons,','Private')`,
    "PROJECT,PARCEL_NAME,DESIGNATION,HOLD1_NAME,HOLD1_TYPE,CALC_AC,RPT_AC,PUB_ACCESS",
    "ME",
    gis.pageSize
  );

  console.log(`  Total for ME: ${allRaw.length} features`);

  const unified: UnifiedFeature[] = allRaw
    .filter((f: any) => f.geometry)
    .map((f: any) => {
      const p = f.properties;
      const holdType = (p.HOLD1_TYPE || "").toLowerCase();
      let ownerType = "UNK";
      if (holdType === "federal") ownerType = "FED";
      else if (holdType === "state") ownerType = "STAT";
      else if (holdType === "municipal") ownerType = "LOC";
      else if (holdType === "private" || holdType === "other")
        ownerType = "NGO";

      const access = (p.PUB_ACCESS || "").toLowerCase();
      const isPublic = access.startsWith("allowed");

      return {
        type: "Feature" as const,
        properties: {
          name: p.PROJECT?.trim() || p.PARCEL_NAME?.trim() || null,
          owner: p.HOLD1_NAME?.trim() || "Unknown",
          ownerType,
          purpose: "conservation",
          acres: p.CALC_AC || p.RPT_AC || 0,
          publicAccess: isPublic ? "yes" : "limited",
        },
        geometry: f.geometry,
      };
    });

  setCache(cacheKey, unified);
  return unified;
}

// --- Rhode Island (RIDEM — two layers: state + local) ---
async function fetchRIAreas(): Promise<UnifiedFeature[]> {
  const cacheKey = "ri_ridem_unified_v1";
  const cached = getCached<UnifiedFeature[]>(cacheKey);
  if (cached) {
    console.log(`  Using cached RI RIDEM data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching RI RIDEM Conservation Lands...");

  // Layer 3: State conservation land
  const stateRaw = await fetchStateGIS(
    STATE_GIS.RI_STATE.url,
    `Acres>=${MIN_ACRES_SANCTUARIES} AND Pub_Access IN ('YES','LIM')`,
    "NAME,DEM_AREA,Pub_Access,Acres,PrimUse",
    "RI state",
    STATE_GIS.RI_STATE.pageSize
  );

  // Layer 4: Local conservation land
  const localRaw = await fetchStateGIS(
    STATE_GIS.RI_LOCAL.url,
    `GIS_Acre>=${MIN_ACRES_SANCTUARIES} AND PUBACC IN ('YES','LIM')`,
    "Site,Com_Name,Fee_Own,FOwnTyp,PUBACC,GIS_Acre,PURP",
    "RI local",
    STATE_GIS.RI_LOCAL.pageSize
  );

  console.log(
    `  Total for RI: ${stateRaw.length + localRaw.length} features (${stateRaw.length} state + ${localRaw.length} local)`
  );

  const unified: UnifiedFeature[] = [];

  // Normalize state features
  for (const f of stateRaw) {
    if (!f.geometry) continue;
    const p = f.properties;
    unified.push({
      type: "Feature",
      properties: {
        name: p.NAME?.trim() || p.DEM_AREA?.trim() || null,
        owner: "State of Rhode Island",
        ownerType: "STAT",
        purpose: (p.PrimUse || "").toLowerCase().includes("rec")
          ? "recreation"
          : "conservation",
        acres: p.Acres || 0,
        publicAccess: p.Pub_Access === "YES" ? "yes" : "limited",
      },
      geometry: f.geometry,
    });
  }

  // Normalize local features
  for (const f of localRaw) {
    if (!f.geometry) continue;
    const p = f.properties;
    const fownTyp = (p.FOwnTyp || "").toUpperCase();
    let ownerType = "NGO";
    if (fownTyp === "MUN") ownerType = "LOC";
    else if (fownTyp === "STA") ownerType = "STAT";
    else if (fownTyp === "FED") ownerType = "FED";
    else if (fownTyp === "LTR" || fownTyp === "NGO") ownerType = "NGO";

    unified.push({
      type: "Feature",
      properties: {
        name: p.Site?.trim() || p.Com_Name?.trim() || null,
        owner: p.Fee_Own?.trim() || "Unknown",
        ownerType,
        purpose: "conservation",
        acres: p.GIS_Acre || 0,
        publicAccess: p.PUBACC === "YES" ? "yes" : "limited",
      },
      geometry: f.geometry,
    });
  }

  setCache(cacheKey, unified);
  return unified;
}

// --- Vermont (VCGI Protected Lands) ---
async function fetchVTAreas(): Promise<UnifiedFeature[]> {
  const cacheKey = "vt_vcgi_unified_v1";
  const cached = getCached<UnifiedFeature[]>(cacheKey);
  if (cached) {
    console.log(`  Using cached VT VCGI data (${cached.length} features)`);
    return cached;
  }

  console.log("  Fetching VT Protected Lands Database...");
  const gis = STATE_GIS.VT;
  // PUBACCESS: 1=Public, 2=Limited public (easement), 3=No public, 4=Public limited, 5=Unknown
  // OWNERKIND: PUB=Public, PRIV=Private
  // Filter for publicly accessible or limited access
  const allRaw = await fetchStateGIS(
    gis.url,
    `GISACRES>=${MIN_ACRES_SANCTUARIES} AND PUBACCESS IN ('1','2','4')`,
    "NAME,PAGENCY1,PTYPE1,PUBACCESS,GISACRES,OWNERKIND,DESIGNAT",
    "VT",
    gis.pageSize
  );

  console.log(`  Total for VT: ${allRaw.length} features`);

  const unified: UnifiedFeature[] = allRaw
    .filter((f: any) => f.geometry)
    .map((f: any) => {
      const p = f.properties;
      // Determine owner type from OWNERKIND + DESIGNAT
      let ownerType = "UNK";
      const desig = (p.DESIGNAT || "").toLowerCase();
      if (p.OWNERKIND === "PUB") {
        if (desig.includes("federal") || desig.includes("national"))
          ownerType = "FED";
        else if (desig.includes("state")) ownerType = "STAT";
        else if (desig.includes("municipal") || desig.includes("town"))
          ownerType = "LOC";
        else ownerType = "STAT"; // default for public
      } else {
        ownerType = "NGO"; // private conservation
      }

      return {
        type: "Feature" as const,
        properties: {
          name: p.NAME?.trim() || null,
          owner: "Unknown",
          ownerType,
          purpose: "conservation",
          acres: p.GISACRES || 0,
          publicAccess: p.PUBACCESS === "1" ? "yes" : "limited",
        },
        geometry: f.geometry,
      };
    });

  setCache(cacheKey, unified);
  return unified;
}

/** Fetch areas for any non-MA state — dispatches to state-specific function */
async function fetchStateAreas(state: NEState): Promise<UnifiedFeature[]> {
  switch (state) {
    case "CT": return fetchCTAreas();
    case "NH": return fetchNHAreas();
    case "ME": return fetchMEAreas();
    case "RI": return fetchRIAreas();
    case "VT": return fetchVTAreas();
    default: throw new Error(`No GIS source configured for ${state}`);
  }
}

// ============================================================
// Stage 2: Group and merge parcels (shared logic)
// ============================================================

function mapOwnerType(code: string): MergedArea["ownerType"] {
  switch (code) {
    case "FED":
      return "federal";
    case "STAT":
      return "state";
    case "LOC":
    case "DIST":
      return "municipal";
    case "NGO":
      return "nonprofit";
    case "PVT":
      return "nonprofit";
    case "JNT":
      return "other";
    default:
      return "other";
  }
}

function computeBBox(
  features: UnifiedFeature[]
): [number, number, number, number] {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  for (const f of features) {
    if (!f.geometry) continue;
    const coords = extractCoords(f.geometry);
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Sub-cluster parcels by geographic proximity using union-find.
 */
function clusterByProximity(
  parcels: UnifiedFeature[],
  thresholdKm: number
): UnifiedFeature[][] {
  if (parcels.length <= 1) return [parcels];

  const centroids: [number, number][] = parcels.map((p) => {
    if (!p.geometry) return [0, 0];
    const coords = extractCoords(p.geometry);
    if (coords.length === 0) return [0, 0];
    const sumLng = coords.reduce((s, c) => s + c[0], 0);
    const sumLat = coords.reduce((s, c) => s + c[1], 0);
    return [sumLng / coords.length, sumLat / coords.length];
  });

  const parent = parcels.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function unite(a: number, b: number) {
    parent[find(a)] = find(b);
  }

  for (let i = 0; i < parcels.length; i++) {
    for (let j = i + 1; j < parcels.length; j++) {
      const from = turf.point(centroids[i]);
      const to = turf.point(centroids[j]);
      const dist = turf.distance(from, to, { units: "kilometers" });
      if (dist <= thresholdKm) {
        unite(i, j);
      }
    }
  }

  const clusters = new Map<number, UnifiedFeature[]>();
  for (let i = 0; i < parcels.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(parcels[i]);
  }
  return Array.from(clusters.values());
}

/**
 * Merge polygon geometries for a group of parcels.
 * Uses buffer/union/unbuffer (morphological close) to bridge gaps between
 * adjacent parcels, producing a clean single polygon.
 */
function mergePolygons(
  parcels: UnifiedFeature[],
  totalAcres: number
): GeoJSON.Geometry | null {
  const validPolygons: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  >[] = [];
  for (const p of parcels) {
    if (!p.geometry) continue;
    if (
      p.geometry.type === "Polygon" ||
      p.geometry.type === "MultiPolygon"
    ) {
      validPolygons.push(
        turf.feature(p.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)
      );
    }
  }

  if (validPolygons.length === 0) return null;
  if (validPolygons.length === 1) return validPolygons[0].geometry;

  let combinedGeometry: GeoJSON.Geometry | null = null;

  try {
    // Use larger buffer for areas with many parcels (large state forests)
    const bufferKm = validPolygons.length >= 10 ? 0.8 : 0.5;
    const unbufferKm = -(bufferKm - 0.05);
    const buffered = validPolygons.map((p) => {
      const b = turf.buffer(p, bufferKm, { units: "kilometers" });
      return b || p;
    });
    // Union all buffered parcels
    let merged = buffered[0];
    for (let i = 1; i < buffered.length; i++) {
      const result = turf.union(
        turf.featureCollection([merged, buffered[i]])
      );
      if (result) merged = result;
    }
    // Un-buffer to restore approximate original boundary
    const unbuffered = turf.buffer(merged, unbufferKm, { units: "kilometers" });
    if (unbuffered) {
      combinedGeometry = unbuffered.geometry;
    } else {
      combinedGeometry = merged.geometry;
    }
  } catch {
    // If union fails, fall back to simple MultiPolygon
    const allCoords: number[][][][] = [];
    for (const p of validPolygons) {
      if (p.geometry.type === "Polygon") {
        allCoords.push(p.geometry.coordinates);
      } else {
        for (const c of p.geometry.coordinates) allCoords.push(c);
      }
    }
    combinedGeometry = { type: "MultiPolygon", coordinates: allCoords };
  }

  // Simplify the final geometry
  if (combinedGeometry) {
    try {
      // Scale tolerance with area size to keep file reasonable for 6 states
      const tol = totalAcres > 10000 ? 0.008 : totalAcres > 1000 ? 0.005 : totalAcres > 100 ? 0.003 : 0.002;
      const simplified = turf.simplify(
        turf.feature(combinedGeometry as any),
        { tolerance: tol, highQuality: true }
      );
      combinedGeometry = simplified.geometry;
    } catch {
      // Degenerate polygon — keep as-is
    }
  }

  return combinedGeometry;
}

function mergeAreas(
  features: UnifiedFeature[],
  state: NEState
): MergedArea[] {
  console.log(`  Grouping parcels by name...`);

  // Generic names that need owner/town disambiguation
  const GENERIC_NAMES = new Set([
    "Conservation Area",
    "Conservation Land",
    "Conservation Restriction",
    "Open Space",
    "Town Forest",
    "Town Land",
    "Town Park",
    "Agricultural Preservation Restriction",
    "State Forest",
    "State Park",
    "Wildlife Management Area",
  ]);

  // Group by name (disambiguate generic names with owner)
  const groups = new Map<string, UnifiedFeature[]>();
  let unnamed = 0;

  for (const f of features) {
    let name = f.properties.name;
    if (!name || name === "" || name === "null") {
      unnamed++;
      continue;
    }
    // Append owner to generic names to avoid grouping unrelated parcels
    if (GENERIC_NAMES.has(name) && f.properties.owner && f.properties.owner !== "Unknown") {
      name = `${name} (${f.properties.owner})`;
    } else if (GENERIC_NAMES.has(name)) {
      // Skip generic-named areas with no owner — can't disambiguate
      unnamed++;
      continue;
    }
    const existing = groups.get(name) || [];
    existing.push(f);
    groups.set(name, existing);
  }

  // Sub-cluster by proximity — 2km keeps nearby parcels together without
  // merging distant same-named areas into disjointed shapes
  const PROXIMITY_THRESHOLD_KM = 2;
  let splitCount = 0;
  const clusteredGroups = new Map<string, UnifiedFeature[]>();
  for (const [name, parcels] of groups) {
    const clusters = clusterByProximity(parcels, PROXIMITY_THRESHOLD_KM);
    if (clusters.length === 1) {
      clusteredGroups.set(name, parcels);
    } else {
      splitCount += clusters.length - 1;
      clusters.sort(
        (a, b) =>
          b.reduce((s, p) => s + p.properties.acres, 0) -
          a.reduce((s, p) => s + p.properties.acres, 0)
      );
      const usedNames = new Set<string>();
      for (let i = 0; i < clusters.length; i++) {
        const owner = clusters[i][0].properties.owner;
        let clusterName: string;
        if (i === 0) {
          clusterName = name;
        } else {
          // Avoid double-appending owner if name already contains it (from generic name disambiguation)
          const ownerAlreadyInName = owner && name.includes(`(${owner})`);
          if (ownerAlreadyInName) {
            clusterName = `${name} #${i + 1}`;
          } else {
            const suffix =
              owner && owner !== "Unknown" ? ` (${owner})` : ` #${i + 1}`;
            clusterName = `${name}${suffix}`;
          }
        }
        if (usedNames.has(clusterName)) {
          clusterName = `${clusterName} #${i + 1}`;
        }
        usedNames.add(clusterName);
        clusteredGroups.set(clusterName, clusters[i]);
      }
    }
  }

  console.log(
    `  ${groups.size} named areas (${unnamed} unnamed parcels skipped)`
  );
  if (splitCount > 0) {
    console.log(
      `  ${splitCount} distant parcel groups split into separate areas (${clusteredGroups.size} total)`
    );
  }

  // Merge each group
  const merged: MergedArea[] = [];
  const seenIds = new Set<string>();

  for (const [name, parcels] of clusteredGroups) {
    const rep = parcels[0].properties;

    const totalAcres = parcels.reduce(
      (sum, p) => sum + p.properties.acres,
      0
    );

    // Skip if total area too small
    const isSanctuary =
      /sanctuary|wildlife|nature|preserve|reserve|audubon|conservation|pond|wetland|marsh/i.test(
        name
      );
    const minThreshold = isSanctuary ? MIN_ACRES_SANCTUARIES : MIN_ACRES;
    if (totalAcres < minThreshold) continue;

    const bbox = computeBBox(parcels);
    const centroid = computeCentroid(bbox);
    const combinedGeometry = mergePolygons(parcels, totalAcres);

    // State-prefixed ID
    let id = `${state.toLowerCase()}-${slugify(name)}`;
    if (seenIds.has(id)) {
      id = `${id}-${rep.ownerType.toLowerCase()}`;
    }
    seenIds.add(id);

    merged.push({
      id,
      name,
      state,
      owner: rep.owner,
      ownerType: mapOwnerType(rep.ownerType),
      purpose: rep.purpose,
      acreage: Math.round(totalAcres * 10) / 10,
      publicAccess: rep.publicAccess as "yes" | "limited",
      centroid,
      bbox,
      geometry: combinedGeometry,
      parcelCount: parcels.length,
    });
  }

  merged.sort((a, b) => b.acreage - a.acreage);
  console.log(`  ${merged.length} merged areas for ${state}`);
  return merged;
}

// ============================================================
// Stage 3: Fetch iNaturalist species per area
// ============================================================

interface INatSpeciesCountResult {
  count: number;
  taxon: {
    id: number;
    name: string;
    preferred_common_name?: string;
    default_photo?: {
      square_url?: string;
      medium_url?: string;
    };
    iconic_taxon_name?: string;
  };
}

function mapIconicTaxonToGroup(iconicTaxon: string | undefined): string {
  switch (iconicTaxon) {
    case "Plantae":
      return "plants";
    case "Aves":
      return "birds";
    case "Mammalia":
      return "mammals";
    case "Amphibia":
      return "amphibians";
    case "Reptilia":
      return "reptiles";
    case "Insecta":
      return "insects";
    case "Arachnida":
      return "arachnids";
    case "Mollusca":
      return "mollusks";
    case "Actinopterygii":
    case "Chondrichthyes":
      return "fish";
    case "Fungi":
      return "fungi";
    default:
      return "other";
  }
}

function buildTaxonIdLookup(): Map<
  number,
  {
    slug: string;
    commonName: string;
    scientificName: string;
    thumbnailUrl?: string;
    group?: string;
  }
> {
  console.log("  Building taxonId → species lookup...");
  const lookup = new Map<number, any>();

  if (!fs.existsSync(SPECIES_DIR)) return lookup;

  const files = fs
    .readdirSync(SPECIES_DIR)
    .filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const species = JSON.parse(
        fs.readFileSync(path.join(SPECIES_DIR, file), "utf-8")
      );
      if (species.taxonId) {
        lookup.set(species.taxonId, {
          slug: species.slug,
          commonName: species.commonName,
          scientificName: species.scientificName,
          thumbnailUrl: species.photos?.[0]?.mediumUrl,
          group: species.group,
        });
      }
    } catch {}
  }

  console.log(`  Loaded ${lookup.size} species into lookup`);
  return lookup;
}

async function fetchAreaSpecies(
  area: MergedArea,
  taxonLookup: Map<number, any>
): Promise<{
  matched: AreaSpeciesEntry[];
  rawTaxonIds: Set<number>;
  fromCache: boolean;
} | null> {
  const cacheKey = `species_${area.id}`;
  const cached = getCached<{
    matched: AreaSpeciesEntry[];
    rawTaxonIds: number[];
  }>(cacheKey);
  if (cached) {
    return {
      matched: cached.matched,
      rawTaxonIds: new Set(cached.rawTaxonIds),
      fromCache: true,
    };
  }

  const [swLng, swLat, neLng, neLat] = area.bbox;
  const bboxWidth = neLng - swLng;
  const bboxHeight = neLat - swLat;
  if (bboxWidth < 0.001 || bboxHeight < 0.001) return null;

  const params = new URLSearchParams({
    swlat: swLat.toFixed(6),
    swlng: swLng.toFixed(6),
    nelat: neLat.toFixed(6),
    nelng: neLng.toFixed(6),
    quality_grade: "research",
    per_page: "100",
    order: "desc",
    order_by: "count",
  });

  const url = `${INAT_BASE}/observations/species_counts?${params}`;
  const resp = await fetchWithRetry(url);
  const data = await resp.json();

  const results: INatSpeciesCountResult[] = data.results || [];
  const matched: AreaSpeciesEntry[] = [];
  const rawTaxonIds = new Set<number>();

  for (const r of results) {
    rawTaxonIds.add(r.taxon.id);
    const localSpecies = taxonLookup.get(r.taxon.id);

    if (localSpecies) {
      matched.push({
        slug: localSpecies.slug,
        commonName: localSpecies.commonName,
        scientificName: localSpecies.scientificName,
        thumbnailUrl: localSpecies.thumbnailUrl,
        group:
          localSpecies.group ||
          mapIconicTaxonToGroup(r.taxon.iconic_taxon_name),
        observationCount: r.count,
        uniquenessScore: 0,
      });
    }
  }

  setCache(cacheKey, { matched, rawTaxonIds: Array.from(rawTaxonIds) });
  return { matched, rawTaxonIds, fromCache: false };
}

async function fetchAllAreaSpecies(
  areas: MergedArea[],
  taxonLookup: Map<number, any>
): Promise<Map<string, AreaSpeciesEntry[]>> {
  console.log(
    `Stage 3: Fetching iNaturalist species for ${areas.length} areas...`
  );

  const areaSpeciesMap = new Map<string, AreaSpeciesEntry[]>();
  let completed = 0;
  let cached = 0;

  for (const area of areas) {
    const result = await fetchAreaSpecies(area, taxonLookup);
    if (result) {
      areaSpeciesMap.set(area.id, result.matched);
      if (result.fromCache) cached++;
    }
    completed++;

    if (completed % 50 === 0 || completed === areas.length) {
      console.log(
        `  ${completed}/${areas.length} areas processed (${areaSpeciesMap.size} with data, ${cached} from cache)`
      );
    }

    if (!result?.fromCache) {
      // Slow down if we're deep into the run to avoid sustained rate limiting
      const baseDelay = completed > 5000 ? 1500 : 1100;
      await sleep(baseDelay);
    }
  }

  console.log(`  Completed: ${areaSpeciesMap.size} areas with species data`);
  return areaSpeciesMap;
}

// ============================================================
// Stage 4: Compute uniqueness scores
// ============================================================

function computeUniqueness(
  areaSpeciesMap: Map<string, AreaSpeciesEntry[]>
): void {
  console.log("Stage 4: Computing species uniqueness scores...");

  const speciesAreaCount = new Map<string, number>();
  const totalAreas = areaSpeciesMap.size;

  for (const [, speciesList] of areaSpeciesMap) {
    const slugsSeen = new Set<string>();
    for (const sp of speciesList) {
      if (!slugsSeen.has(sp.slug)) {
        slugsSeen.add(sp.slug);
        speciesAreaCount.set(
          sp.slug,
          (speciesAreaCount.get(sp.slug) || 0) + 1
        );
      }
    }
  }

  for (const [, speciesList] of areaSpeciesMap) {
    for (const sp of speciesList) {
      const count = speciesAreaCount.get(sp.slug) || 1;
      sp.uniquenessScore =
        Math.round((1 - count / totalAreas) * 1000) / 1000;
    }
  }

  console.log(
    `  Scored ${speciesAreaCount.size} unique species across ${totalAreas} areas`
  );
}

// ============================================================
// Stage 5: Write output files
// ============================================================

function writeOutputs(
  areas: MergedArea[],
  areaSpeciesMap: Map<string, AreaSpeciesEntry[]>
): void {
  console.log("Stage 5: Writing output files...");
  ensureDir(DATA_DIR);

  const areasOutput = {
    generatedAt: new Date().toISOString(),
    region: "new-england",
    states: [...NE_STATES],
    totalAreas: areas.length,
    areas: areas.map((a) => ({
      id: a.id,
      name: a.name,
      state: a.state,
      owner: a.owner,
      ownerType: a.ownerType,
      purpose: a.purpose,
      acreage: a.acreage,
      publicAccess: a.publicAccess,
      centroid: a.centroid,
      bbox: a.bbox,
      geometry: a.geometry,
    })),
  };

  const areasPath = path.join(DATA_DIR, "nature-areas.json");
  fs.writeFileSync(areasPath, JSON.stringify(areasOutput), "utf-8");
  const areasSize = (fs.statSync(areasPath).size / 1024 / 1024).toFixed(1);
  console.log(
    `  Wrote ${areasPath} (${areasSize} MB, ${areas.length} areas)`
  );

  const speciesIndex: Record<
    string,
    { speciesFound: number; groupBreakdown: Record<string, number> }
  > = {};
  const areaSpeciesDir = path.join(
    path.dirname(DATA_DIR),
    "public",
    "area-species"
  );
  ensureDir(areaSpeciesDir);

  for (const [areaId, speciesList] of areaSpeciesMap) {
    const sorted = [...speciesList].sort(
      (a, b) => b.uniquenessScore - a.uniquenessScore
    );

    const groupBreakdown: Record<string, number> = {};
    for (const sp of speciesList) {
      groupBreakdown[sp.group] = (groupBreakdown[sp.group] || 0) + 1;
    }

    const groupHighlights: Record<string, AreaSpeciesEntry[]> = {};
    for (const [group] of Object.entries(groupBreakdown)) {
      groupHighlights[group] = sorted.filter((sp) => sp.group === group);
    }

    const highlights = sorted
      .filter((sp) => sp.uniquenessScore > 0.85)
      .slice(0, 30);
    const commonPool = sorted.filter((sp) => sp.uniquenessScore <= 0.85);
    const common = commonPool.slice(-20).reverse();

    speciesIndex[areaId] = {
      speciesFound: speciesList.length,
      groupBreakdown,
    };

    const areaData = {
      areaId,
      speciesFound: speciesList.length,
      highlights,
      common,
      groupBreakdown,
      groupHighlights,
    };
    fs.writeFileSync(
      path.join(areaSpeciesDir, `${areaId}.json`),
      JSON.stringify(areaData),
      "utf-8"
    );
  }

  const indexOutput = {
    generatedAt: new Date().toISOString(),
    areaSpecies: speciesIndex,
  };
  const indexPath = path.join(DATA_DIR, "nature-areas-species-index.json");
  fs.writeFileSync(indexPath, JSON.stringify(indexOutput), "utf-8");
  const indexSize = (fs.statSync(indexPath).size / 1024 / 1024).toFixed(1);
  console.log(
    `  Wrote ${indexPath} (${indexSize} MB, ${Object.keys(speciesIndex).length} areas)`
  );
  console.log(
    `  Wrote ${Object.keys(speciesIndex).length} per-area files to ${areaSpeciesDir}`
  );
}

// ============================================================
// Main
// ============================================================

async function main() {
  const skipSpecies = process.argv.includes("--skip-species");
  const stateArg = process.argv
    .find((a) => a.startsWith("--state="))
    ?.split("=")[1]
    ?.toUpperCase();
  const statesToFetch: NEState[] = stateArg
    ? [stateArg as NEState]
    : [...NE_STATES];

  console.log("=== Nature Areas Pipeline ===\n");
  console.log(
    `States: ${statesToFetch.map((s) => STATE_NAMES[s]).join(", ")}\n`
  );

  let allAreas: MergedArea[] = [];

  for (const state of statesToFetch) {
    console.log(`\n--- ${STATE_NAMES[state]} (${state}) ---`);

    // Each state uses its own GIS portal for best coverage
    const features =
      state === "MA"
        ? await fetchMassGISAreas()
        : await fetchStateAreas(state);

    const areas = mergeAreas(features, state);
    allAreas.push(...areas);
  }

  allAreas.sort((a, b) => b.acreage - a.acreage);
  console.log(
    `\nTotal: ${allAreas.length} merged areas across ${statesToFetch.length} states`
  );

  if (skipSpecies) {
    console.log("\n--skip-species flag: skipping iNaturalist species fetch");
    writeOutputs(allAreas, new Map());
  } else {
    const taxonLookup = buildTaxonIdLookup();
    const areaSpeciesMap = await fetchAllAreaSpecies(allAreas, taxonLookup);
    computeUniqueness(areaSpeciesMap);
    writeOutputs(allAreas, areaSpeciesMap);
  }

  console.log("\n=== Done! ===");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
