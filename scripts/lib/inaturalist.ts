import { getCached, setCache } from "./cache";
import type {
  INatPaginatedResponse,
  INatSpeciesCount,
  INatTaxon,
  INatObservation,
} from "./types";

const BASE_URL = "https://api.inaturalist.org/v1";

// New England state place_ids (verified via /v1/places/autocomplete)
const NE_PLACE_IDS = "2,8,17,41,47,49"; // MA,RI,ME,NH,VT,CT

// Rate limiting: 1 request per second (iNaturalist recommends ~60/min)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1500; // 1.5s between requests for sustained bulk fetching

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

async function fetchWithRetry(
  url: string,
  maxRetries = 5
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await rateLimit();

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      // Network/socket error — retry with backoff
      const waitTime = Math.min(Math.pow(2, attempt) * 10000, 120000);
      console.warn(
        `  Network error: ${(err as Error).message}. Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    if (response.ok) return response;

    if (response.status === 429) {
      // Rate limited — exponential backoff starting at 30s
      const waitTime = Math.min(Math.pow(2, attempt) * 30000, 300000); // 30s, 60s, 120s, 240s, 300s max
      console.warn(
        `  Rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    if (response.status >= 500) {
      // Server error — retry with backoff
      const waitTime = Math.pow(2, attempt) * 2000;
      console.warn(
        `  Server error (${response.status}). Waiting ${waitTime / 1000}s before retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    throw new Error(`iNaturalist API error: ${response.status} ${response.statusText} for ${url}`);
  }
  throw new Error(`Failed after ${maxRetries} retries: ${url}`);
}

/**
 * Fetch all species observed in New England for a given taxon group.
 * Paginates through all results.
 */
export async function fetchSpeciesCounts(
  taxonId: number
): Promise<INatSpeciesCount[]> {
  const cacheKeyStr = `species_counts_${taxonId}`;
  const cached = getCached<INatSpeciesCount[]>("species", cacheKeyStr);
  if (cached) {
    console.log(`  Using cached species counts (${cached.length} species)`);
    return cached;
  }

  const allResults: INatSpeciesCount[] = [];
  let page = 1;
  const perPage = 500;
  let totalResults = Infinity;

  console.log(`  Fetching species counts from iNaturalist (taxon ${taxonId})...`);

  while (allResults.length < totalResults && page <= 20) {
    // max 10000 results = 20 pages of 500
    const params = new URLSearchParams({
      place_id: NE_PLACE_IDS,
      taxon_id: taxonId.toString(),
      quality_grade: "research",
      per_page: perPage.toString(),
      page: page.toString(),
      order: "desc",
      order_by: "count",
    });

    const url = `${BASE_URL}/observations/species_counts?${params}`;
    const response = await fetchWithRetry(url);
    const data: INatPaginatedResponse<INatSpeciesCount> = await response.json();

    totalResults = data.total_results;
    allResults.push(...data.results);
    console.log(
      `  Page ${page}: ${data.results.length} species (${allResults.length}/${totalResults} total)`
    );
    page++;
  }

  setCache("species", cacheKeyStr, allResults);
  return allResults;
}

/**
 * Fetch top species observed in a specific month in New England for a taxon group.
 * Uses the species_counts endpoint with month filter.
 */
export async function fetchSpeciesCountsByMonth(
  taxonId: number,
  month: number,
  perPage = 30
): Promise<INatSpeciesCount[]> {
  const cacheKeyStr = `monthly_species_${taxonId}_month${month}`;
  const cached = getCached<INatSpeciesCount[]>("monthly", cacheKeyStr);
  if (cached) return cached;

  const params = new URLSearchParams({
    place_id: NE_PLACE_IDS,
    taxon_id: taxonId.toString(),
    month: month.toString(),
    verifiable: "true",
    per_page: perPage.toString(),
    order: "desc",
    order_by: "count",
  });

  const url = `${BASE_URL}/observations/species_counts?${params}`;
  const response = await fetchWithRetry(url);
  const data: INatPaginatedResponse<INatSpeciesCount> = await response.json();

  setCache("monthly", cacheKeyStr, data.results);
  return data.results;
}

/**
 * Fetch full taxon details including ancestors for a given taxon ID.
 */
export async function fetchTaxonDetails(taxonId: number): Promise<INatTaxon | null> {
  const cacheKeyStr = `taxon_${taxonId}`;
  const cached = getCached<INatTaxon>("taxon", cacheKeyStr);
  if (cached) return cached;

  const url = `${BASE_URL}/taxa/${taxonId}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();

  if (!data.results || data.results.length === 0) return null;

  const taxon: INatTaxon = data.results[0];
  setCache("taxon", cacheKeyStr, taxon);
  return taxon;
}

/**
 * Fetch multiple taxon details in a single batch request (up to 30 at a time).
 */
export async function fetchTaxaBatch(taxonIds: number[]): Promise<INatTaxon[]> {
  const results: INatTaxon[] = [];
  const uncachedIds: number[] = [];

  // Check cache first
  for (const id of taxonIds) {
    const cached = getCached<INatTaxon>("taxon", `taxon_${id}`);
    if (cached) {
      results.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }

  // Fetch uncached in batches of 30 (iNaturalist limit)
  for (let i = 0; i < uncachedIds.length; i += 30) {
    const batch = uncachedIds.slice(i, i + 30);
    const url = `${BASE_URL}/taxa/${batch.join(",")}`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (data.results) {
      for (const taxon of data.results) {
        setCache("taxon", `taxon_${taxon.id}`, taxon);
        results.push(taxon);
      }
    }
  }

  return results;
}

/**
 * Fetch CC-licensed photos for a species in New England.
 * Default strategy sorts by votes (most popular observations).
 */
export async function fetchSpeciesPhotos(
  taxonId: number,
  maxPhotos = 10,
  strategy: "votes" | "recent" | "random" = "votes"
): Promise<INatObservation[]> {
  const cacheKeyStr = `photos_${taxonId}_${strategy}`;
  const cached = getCached<INatObservation[]>("photos", cacheKeyStr);
  if (cached) return cached;

  const params = new URLSearchParams({
    taxon_id: taxonId.toString(),
    place_id: NE_PLACE_IDS,
    quality_grade: "research",
    photos: "true",
    photo_license: "cc-by,cc-by-nc,cc0,cc-by-sa,cc-by-nd,cc-by-nc-sa",
    per_page: maxPhotos.toString(),
  });

  switch (strategy) {
    case "votes":
      params.set("order_by", "votes");
      params.set("order", "desc");
      break;
    case "recent":
      params.set("order_by", "created_at");
      params.set("order", "desc");
      break;
    case "random":
      params.set("order_by", "random");
      break;
  }

  const url = `${BASE_URL}/observations?${params}`;
  const response = await fetchWithRetry(url);
  const data: INatPaginatedResponse<INatObservation> = await response.json();

  setCache("photos", cacheKeyStr, data.results);
  return data.results;
}

/**
 * Fetch the curated taxon photos from the iNaturalist taxon page itself.
 * These are hand-selected by the iNaturalist community and are usually
 * high quality representative photos.
 */
export async function fetchTaxonPhotos(
  taxonId: number
): Promise<INatObservation[]> {
  const cacheKeyStr = `taxon_photos_${taxonId}`;
  const cached = getCached<INatObservation[]>("photos", cacheKeyStr);
  if (cached) return cached;

  // The taxa endpoint returns taxon_photos which are curated
  const url = `${BASE_URL}/taxa/${taxonId}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    setCache("photos", cacheKeyStr, []);
    return [];
  }

  const taxon = data.results[0] as INatTaxon;
  const taxonPhotos = taxon.taxon_photos || [];

  // Convert taxon_photos to observation-like format for consistency
  const fakeObservations: INatObservation[] = taxonPhotos.map((tp, i) => ({
    id: -(taxonId * 100 + i), // negative IDs to mark as taxon photos
    quality_grade: "research",
    photos: [tp.photo],
    user: { login: "iNaturalist", name: "iNaturalist Community" },
  }));

  setCache("photos", cacheKeyStr, fakeObservations);
  return fakeObservations;
}

/**
 * Fetch photos using multiple strategies and combine results.
 * Used as a fallback when the primary strategy yields poor results.
 */
export async function fetchSpeciesPhotosWithFallback(
  taxonId: number,
  maxPhotos = 12
): Promise<INatObservation[]> {
  // Strategy 1: Most voted (original approach)
  const voted = await fetchSpeciesPhotos(taxonId, maxPhotos, "votes");

  // Strategy 2: Recent observations (different pool of photos)
  const recent = await fetchSpeciesPhotos(taxonId, maxPhotos, "recent");

  // Strategy 3: Curated taxon photos from the taxon page
  const curated = await fetchTaxonPhotos(taxonId);

  // Combine all, deduplicating by photo ID
  const seen = new Set<number>();
  const combined: INatObservation[] = [];

  // Curated first (highest quality), then voted, then recent
  for (const obs of [...curated, ...voted, ...recent]) {
    if (!obs.photos) continue;
    // Deduplicate by first photo ID
    const photoId = obs.photos[0]?.id;
    if (photoId && !seen.has(photoId)) {
      seen.add(photoId);
      combined.push(obs);
    }
  }

  return combined;
}
