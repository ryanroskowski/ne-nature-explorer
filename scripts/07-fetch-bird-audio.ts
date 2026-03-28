/**
 * Stage 7: Fetch bird audio from Xeno-canto API
 *
 * For each bird species, fetches high-quality recordings (song + call)
 * from the Xeno-canto database. Results are cached per-species for
 * resume-safety, then written to data/pipeline/birds/audio.json.
 *
 * Xeno-canto API v2 — no API key required, 1 req/sec rate limit.
 * All recordings are CC-licensed with proper attribution.
 */

import fs from "fs";
import path from "path";
import { getCached, setCache } from "./lib/cache";

// Types
interface XenoCantoRecording {
  id: string;
  gen: string;       // genus
  sp: string;        // species epithet
  ssp: string;       // subspecies
  en: string;        // English name
  rec: string;       // recordist
  cnt: string;       // country
  loc: string;       // location
  lat: string;
  lng: string;
  type: string;      // "song", "call", etc.
  sex: string;
  stage: string;
  q: string;         // quality A-E
  length: string;    // "0:45"
  date: string;
  time: string;
  url: string;       // page URL
  file: string;      // download path (//xeno-canto.org/{id}/download)
  "file-name": string;
  lic: string;       // license URL
  sono: {
    small: string;
    med: string;
    large: string;
    full: string;
  };
  also: string[];    // background species
  rmk: string;       // remarks
  smp: number;       // sample rate
}

interface XenoCantoResponse {
  numRecordings: string;
  numSpecies: string;
  page: number;
  numPages: number;
  recordings: XenoCantoRecording[];
}

export interface BirdAudioEntry {
  xenoCantoId: string;
  type: string;           // "song", "call", "alarm call", etc.
  audioUrl: string;       // direct download URL
  pageUrl: string;        // xeno-canto page for this recording
  recordist: string;
  license: string;
  quality: string;        // A, B, C, etc.
  length: string;         // "0:45"
  location: string;
  sonogramUrl: string;    // medium sonogram image
}

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
}

import dotenv from "dotenv";
dotenv.config({ override: true });

const XENO_CANTO_API = "https://xeno-canto.org/api/3/recordings";
const XENO_CANTO_KEY = process.env.XENO_CANTO_API_KEY;
const CACHE_NAMESPACE = "xeno_canto";
const RATE_LIMIT_MS = 1100; // slightly over 1 second to be safe

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize the recording type for consistent categorization.
 * Maps various xeno-canto type values to simpler categories.
 */
function normalizeType(rawType: string): string {
  const lower = rawType.toLowerCase();
  if (lower.includes("song") || lower.includes("dawn")) return "song";
  if (lower.includes("alarm")) return "alarm";
  if (lower.includes("call") || lower.includes("contact")) return "call";
  if (lower.includes("drum")) return "drumming";
  return "call"; // default
}

/**
 * Fetch recordings from Xeno-canto for a given scientific name.
 * Uses quality filter to only get A or B rated recordings.
 */
async function fetchRecordings(scientificName: string): Promise<XenoCantoRecording[]> {
  if (!XENO_CANTO_KEY) {
    console.error("Missing XENO_CANTO_API_KEY in .env");
    process.exit(1);
  }
  // API v3 requires tag-based queries
  const parts = scientificName.split(" ");
  const genus = parts[0] || "";
  const species = parts[1] || "";
  const query = `gen:${genus} sp:${species} q_gt:C`;
  const url = `${XENO_CANTO_API}?query=${encodeURIComponent(query)}&key=${XENO_CANTO_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`  ✗ Xeno-canto API error for ${scientificName}: ${response.status}`);
    return [];
  }

  const data: XenoCantoResponse = await response.json();
  return data.recordings || [];
}

/**
 * Select the best recordings for a species:
 * - 1 best song (quality A preferred, then B)
 * - 1 best call
 * - 1 optional alarm/drumming if available
 * Max 3 recordings per species.
 */
function selectBestRecordings(recordings: XenoCantoRecording[]): BirdAudioEntry[] {
  if (recordings.length === 0) return [];

  // Sort by quality (A first, then B)
  const qualityOrder: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const sorted = [...recordings].sort(
    (a, b) => (qualityOrder[a.q] ?? 5) - (qualityOrder[b.q] ?? 5)
  );

  // Group by normalized type
  const byType = new Map<string, XenoCantoRecording[]>();
  for (const rec of sorted) {
    const type = normalizeType(rec.type);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(rec);
  }

  const selected: BirdAudioEntry[] = [];

  // Pick best song
  const songs = byType.get("song");
  if (songs && songs.length > 0) {
    selected.push(toAudioEntry(songs[0], "song"));
  }

  // Pick best call
  const calls = byType.get("call");
  if (calls && calls.length > 0) {
    selected.push(toAudioEntry(calls[0], "call"));
  }

  // Pick alarm or drumming if we have room
  if (selected.length < 3) {
    for (const type of ["alarm", "drumming"]) {
      const recs = byType.get(type);
      if (recs && recs.length > 0 && selected.length < 3) {
        selected.push(toAudioEntry(recs[0], type));
      }
    }
  }

  // If we have no song or call, just take the best available
  if (selected.length === 0 && sorted.length > 0) {
    selected.push(toAudioEntry(sorted[0], normalizeType(sorted[0].type)));
  }

  return selected;
}

/** Ensure a URL has https:// prefix (v2 returned protocol-relative, v3 returns full URLs) */
function ensureHttps(url: string): string {
  if (url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return `https://${url}`;
}

function toAudioEntry(rec: XenoCantoRecording, type: string): BirdAudioEntry {
  return {
    xenoCantoId: rec.id,
    type,
    audioUrl: ensureHttps(rec.file),
    pageUrl: ensureHttps(rec.url),
    recordist: rec.rec,
    license: ensureHttps(rec.lic),
    quality: rec.q,
    length: rec.length,
    location: rec.loc,
    sonogramUrl: rec.sono?.med ? ensureHttps(rec.sono.med) : "",
  };
}

async function main() {
  console.log("\n=== Stage 7: Fetch Bird Audio (Xeno-canto) ===\n");

  const pipelineDir = path.join(process.cwd(), "data", "pipeline", "birds");
  const speciesListPath = path.join(pipelineDir, "species-enriched.json");

  if (!fs.existsSync(speciesListPath)) {
    console.error("No bird species list found. Run the bird pipeline first.");
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesListPath, "utf-8")
  );

  console.log(`Found ${speciesList.length} bird species`);

  // Load existing audio data for resume support
  const audioOutputPath = path.join(pipelineDir, "audio.json");
  let audioData: Record<string, BirdAudioEntry[]> = {};
  if (fs.existsSync(audioOutputPath)) {
    audioData = JSON.parse(fs.readFileSync(audioOutputPath, "utf-8"));
    console.log(`Resuming — ${Object.keys(audioData).length} species already have audio data`);
  }

  let fetched = 0;
  let cached = 0;
  let noResults = 0;
  let errors = 0;

  for (const species of speciesList) {
    const taxonKey = species.taxonId.toString();

    // Check file-level cache first (from previous run output)
    if (audioData[taxonKey] !== undefined) {
      cached++;
      continue;
    }

    // Check per-species cache
    const cacheKey = `${CACHE_NAMESPACE}_${taxonKey}`;
    const cachedResult = getCached<BirdAudioEntry[]>(CACHE_NAMESPACE, cacheKey);
    if (cachedResult !== null) {
      audioData[taxonKey] = cachedResult;
      cached++;
      continue;
    }

    // Fetch from Xeno-canto
    try {
      const recordings = await fetchRecordings(species.scientificName);
      const selected = selectBestRecordings(recordings);

      audioData[taxonKey] = selected;
      setCache(CACHE_NAMESPACE, cacheKey, selected);

      if (selected.length > 0) {
        console.log(
          `  ✓ ${species.commonName} (${species.scientificName}): ${selected.length} recordings ` +
          `[${selected.map(s => s.type).join(", ")}]`
        );
      } else {
        console.log(`  - ${species.commonName}: no quality recordings found`);
        noResults++;
      }

      fetched++;

      // Rate limit
      await sleep(RATE_LIMIT_MS);

      // Save progress every 50 species
      if (fetched % 50 === 0) {
        fs.writeFileSync(audioOutputPath, JSON.stringify(audioData, null, 2));
        console.log(`  [Checkpoint] Saved progress (${fetched} fetched, ${cached} cached)`);
      }
    } catch (err) {
      console.error(`  ✗ Error for ${species.commonName}:`, err);
      errors++;
    }
  }

  // Final save
  fs.writeFileSync(audioOutputPath, JSON.stringify(audioData, null, 2));

  const withAudio = Object.values(audioData).filter((a) => a.length > 0).length;
  console.log(`\n=== Audio Fetch Complete ===`);
  console.log(`  Total species: ${speciesList.length}`);
  console.log(`  With audio: ${withAudio}`);
  console.log(`  Fetched this run: ${fetched}`);
  console.log(`  From cache: ${cached}`);
  console.log(`  No results: ${noResults}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Output: ${audioOutputPath}\n`);
}

main().catch(console.error);
