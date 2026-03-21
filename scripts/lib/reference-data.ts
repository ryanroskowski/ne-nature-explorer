/**
 * Reference data fetcher for RAG-enhanced content generation.
 *
 * Fetches factual reference material from Wikipedia and iNaturalist
 * to ground Stage 4 content generation in real sources.
 *
 * Wikipedia API etiquette: https://www.mediawiki.org/wiki/API:Etiquette
 * - Must set a descriptive User-Agent header
 * - Batch multiple titles per request using pipe separator
 * - Serial requests (wait for one to finish before starting next)
 */

import { getCached, setCache } from "./cache";

// User-Agent required by Wikipedia API policy
const WIKI_USER_AGENT =
  "NENewEnglandNatureExplorer/1.0 (educational project; nature-explorer-pipeline) Node.js";

// Rate limiting for Wikipedia API
let lastWikiRequestTime = 0;
const WIKI_REQUEST_INTERVAL_MS = 1500; // 1.5s between requests

async function wikiRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastWikiRequestTime;
  if (elapsed < WIKI_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, WIKI_REQUEST_INTERVAL_MS - elapsed));
  }
  lastWikiRequestTime = Date.now();
}

// Rate limiting for iNaturalist API (shared with other iNat calls)
let lastInatRequestTime = 0;
const INAT_REQUEST_INTERVAL_MS = 1500;

async function inatRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastInatRequestTime;
  if (elapsed < INAT_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, INAT_REQUEST_INTERVAL_MS - elapsed));
  }
  lastInatRequestTime = Date.now();
}

export interface ReferenceData {
  wikipediaExtract: string | null;
  inatSummary: string | null;
  source: string; // "wikipedia+inat", "wikipedia", "inat", "none"
}

/**
 * Extract the Wikipedia article title from a Wikipedia URL.
 * e.g. "http://en.wikipedia.org/wiki/Pinus_strobus" → "Pinus_strobus"
 */
function extractWikiTitle(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Strip HTML tags from iNaturalist wikipedia_summary.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate text to maxChars, cutting at last sentence boundary.
 */
function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > maxChars * 0.5
    ? truncated.substring(0, lastPeriod + 1)
    : truncated;
}

/**
 * Fetch Wikipedia intro extract for a species.
 * Uses the MediaWiki API with explaintext for clean plaintext.
 * Includes proper User-Agent header per Wikipedia API policy.
 */
async function fetchWikipediaExtract(
  title: string
): Promise<string | null> {
  const cacheKey = `wiki_extract_${title}`;
  const cached = getCached<string | null>("reference", cacheKey);
  if (cached !== undefined && cached !== null) return cached;
  // Also cache null results (no article found)
  const cachedNull = getCached<{ isNull: true }>(
    "reference",
    cacheKey + "_null"
  );
  if (cachedNull) return null;

  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    format: "json",
    origin: "*",
  });

  const url = `https://en.wikipedia.org/w/api.php?${params}`;

  // Retry up to 3 times with exponential backoff on 429
  let data: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await wikiRateLimit();

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": WIKI_USER_AGENT,
          "Api-User-Agent": WIKI_USER_AGENT,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
      });

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 30000; // 30s, 60s, 120s
        console.warn(
          `    Wikipedia rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt + 1}/3...`
        );
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        console.warn(`    Wikipedia API error: ${response.status}`);
        return null;
      }

      data = await response.json();
      break; // success
    } catch (err) {
      console.warn(
        `    Wikipedia fetch error (attempt ${attempt + 1}): ${(err as Error).message}`
      );
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  try {
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as {
      pageid?: number;
      extract?: string;
      missing?: boolean;
    };

    if (page.missing || !page.extract) {
      setCache("reference", cacheKey + "_null", { isNull: true });
      return null;
    }

    const extract = truncateAtSentence(page.extract, 2000);
    setCache("reference", cacheKey, extract);
    return extract;
  } catch (err) {
    console.warn(`    Wikipedia parse failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fetch iNaturalist taxon wikipedia_summary.
 * This is often the same as Wikipedia intro but sometimes
 * iNaturalist has additional context.
 */
async function fetchInatSummary(taxonId: number): Promise<string | null> {
  const cacheKey = `inat_summary_${taxonId}`;
  const cached = getCached<string | null>("reference", cacheKey);
  if (cached !== undefined && cached !== null) return cached;
  const cachedNull = getCached<{ isNull: true }>(
    "reference",
    cacheKey + "_null"
  );
  if (cachedNull) return null;

  await inatRateLimit();

  try {
    const response = await fetch(
      `https://api.inaturalist.org/v1/taxa/${taxonId}`
    );

    if (!response.ok) {
      console.warn(`    iNaturalist API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const taxon = data.results?.[0];

    if (!taxon?.wikipedia_summary) {
      setCache("reference", cacheKey + "_null", { isNull: true });
      return null;
    }

    const summary = stripHtml(taxon.wikipedia_summary);
    const result = truncateAtSentence(summary, 1500);

    setCache("reference", cacheKey, result);
    return result;
  } catch (err) {
    console.warn(
      `    iNaturalist fetch failed: ${(err as Error).message}`
    );
    return null;
  }
}

/**
 * Fetch all available reference data for a species.
 * Returns combined reference text from Wikipedia and iNaturalist.
 */
export async function fetchReferenceData(params: {
  scientificName: string;
  taxonId: number;
  wikipediaUrl?: string;
}): Promise<ReferenceData> {
  // Check combined cache first
  const cacheKey = `ref_combined_${params.taxonId}`;
  const cached = getCached<ReferenceData>("reference", cacheKey);
  if (cached) return cached;

  let wikipediaExtract: string | null = null;
  let inatSummary: string | null = null;

  // 1. Try Wikipedia via URL (most reliable)
  if (params.wikipediaUrl) {
    const title = extractWikiTitle(params.wikipediaUrl);
    if (title) {
      wikipediaExtract = await fetchWikipediaExtract(title);
    }
  }

  // 2. Try Wikipedia via scientific name as fallback
  if (!wikipediaExtract) {
    wikipediaExtract = await fetchWikipediaExtract(
      params.scientificName.replace(/ /g, "_")
    );
  }

  // 3. Fetch iNaturalist summary only if Wikipedia returned nothing
  // iNat summaries can occasionally be wrong (mismatched taxa), so only use as last resort
  if (!wikipediaExtract) {
    inatSummary = await fetchInatSummary(params.taxonId);

    // Sanity check: discard iNat summary if it doesn't mention the genus name
    // (catches API mismatches like returning wrasse data for a grass)
    if (inatSummary) {
      const genus = params.scientificName.split(" ")[0].toLowerCase();
      if (!inatSummary.toLowerCase().includes(genus)) {
        console.warn(
          `    iNat summary doesn't mention genus "${genus}" — discarding`
        );
        inatSummary = null;
      }
    }
  }

  // Determine source
  let source: string;
  if (wikipediaExtract && inatSummary) source = "wikipedia+inat";
  else if (wikipediaExtract) source = "wikipedia";
  else if (inatSummary) source = "inat";
  else source = "none";

  const result: ReferenceData = { wikipediaExtract, inatSummary, source };
  setCache("reference", cacheKey, result);
  return result;
}

/**
 * Format reference data into a prompt-ready string.
 * Returns empty string if no reference data available.
 */
export function formatReferenceForPrompt(ref: ReferenceData): string {
  if (ref.source === "none") {
    return "\n[No reference material available — use your training knowledge, but flag any uncertain claims.]\n";
  }

  let text =
    "\n--- REFERENCE MATERIAL (use to ground your response in facts) ---\n";

  if (ref.wikipediaExtract) {
    text += `\nWikipedia:\n${ref.wikipediaExtract}\n`;
  }

  if (ref.inatSummary) {
    text += `\niNaturalist:\n${ref.inatSummary}\n`;
  }

  text += "\n--- END REFERENCE MATERIAL ---\n";
  text +=
    "IMPORTANT: Base your response on the reference material above. ";
  text +=
    "If you need to go beyond the references, ensure accuracy from your training knowledge. ";
  text +=
    "Do NOT invent specific measurements, dates, or claims not supported by either the references or well-established botanical/ecological facts.\n";

  return text;
}
