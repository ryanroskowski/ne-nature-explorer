/**
 * Stage 8: Fetch amphibian audio from Xeno-canto + iNaturalist
 *
 * For each amphibian species, tries Xeno-canto first (grp:frogs),
 * then falls back to iNaturalist sound observations.
 * Salamanders typically don't vocalize, so they'll be skipped.
 *
 * Results cached per-species for resume-safety.
 */

import fs from "fs";
import path from "path";
import { getCached, setCache } from "./lib/cache";
import dotenv from "dotenv";
dotenv.config({ override: true });

interface AudioEntry {
  xenoCantoId?: string;
  iNatObservationId?: string;
  type: string;
  label?: string;
  audioUrl: string;
  pageUrl: string;
  recordist: string;
  license: string;
  quality: string;
  length: string;
  location: string;
  sonogramUrl: string;
  source: "xeno-canto" | "inaturalist";
}

interface PipelineSpecies {
  taxonId: number;
  scientificName: string;
  commonName: string;
}

const XENO_CANTO_API = "https://xeno-canto.org/api/3/recordings";
const XENO_CANTO_KEY = process.env.XENO_CANTO_API_KEY;
const INAT_API = "https://api.inaturalist.org/v1/observations";
const CACHE_NAMESPACE = "amphibian_audio";
const RATE_LIMIT_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureHttps(url: string): string {
  if (url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return `https://${url}`;
}

function parseLengthSec(length: string): number {
  const parts = length.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

/** Try Xeno-canto first for frog/toad recordings */
async function fetchFromXenoCanto(scientificName: string): Promise<AudioEntry[]> {
  if (!XENO_CANTO_KEY) return [];

  const parts = scientificName.split(" ");
  const genus = parts[0] || "";
  const species = parts[1] || "";
  const query = `gen:${genus} sp:${species} grp:frogs q_gt:C`;
  const url = `${XENO_CANTO_API}?query=${encodeURIComponent(query)}&key=${XENO_CANTO_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const recordings = data.recordings || [];
    if (recordings.length === 0) return [];

    // Sort by quality
    const qualityOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
    const sorted = [...recordings].sort((a: any, b: any) => {
      const qDiff = (qualityOrder[a.q] ?? 5) - (qualityOrder[b.q] ?? 5);
      if (qDiff !== 0) return qDiff;
      const aDur = parseLengthSec(a.length);
      const bDur = parseLengthSec(b.length);
      return (aDur >= 10 && aDur <= 90 ? 0 : 1) - (bDur >= 10 && bDur <= 90 ? 0 : 1);
    });

    // Pick up to 3 recordings from different recordists
    const selected: AudioEntry[] = [];
    const usedRecordists = new Set<string>();

    for (const rec of sorted) {
      if (selected.length >= 3) break;
      if (usedRecordists.has(rec.rec) && selected.length > 0) continue;

      const label = selected.length === 0 ? "Call" : `Call ${selected.length + 1}`;
      selected.push({
        xenoCantoId: rec.id,
        type: "call",
        label,
        audioUrl: ensureHttps(rec.file),
        pageUrl: ensureHttps(rec.url),
        recordist: rec.rec,
        license: ensureHttps(rec.lic),
        quality: rec.q,
        length: rec.length,
        location: rec.loc,
        sonogramUrl: "",
        source: "xeno-canto",
      });
      usedRecordists.add(rec.rec);
    }

    return selected;
  } catch {
    return [];
  }
}

/** Fallback: try iNaturalist sound observations */
async function fetchFromINaturalist(taxonId: number): Promise<AudioEntry[]> {
  const url = `${INAT_API}?taxon_id=${taxonId}&sounds=true&quality_grade=research&per_page=20&order_by=votes`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const observations = data.results || [];
    if (observations.length === 0) return [];

    const selected: AudioEntry[] = [];
    const usedUsers = new Set<string>();

    for (const obs of observations) {
      if (selected.length >= 3) break;
      const sounds = obs.sounds || [];
      if (sounds.length === 0) continue;

      const sound = sounds[0];
      // Only use CC-licensed sounds
      if (!sound.license_code || sound.license_code === "") continue;

      const userId = obs.user?.login || "";
      if (usedUsers.has(userId) && selected.length > 0) continue;

      const label = selected.length === 0 ? "Call" : `Call ${selected.length + 1}`;
      selected.push({
        iNatObservationId: String(obs.id),
        type: "call",
        label,
        audioUrl: sound.file_url || "",
        pageUrl: `https://www.inaturalist.org/observations/${obs.id}`,
        recordist: obs.user?.name || obs.user?.login || "Unknown",
        license: `https://creativecommons.org/licenses/${sound.license_code.replace("cc-", "").replace(/-/g, "-")}/4.0/`,
        quality: "iNat",
        length: "",
        location: obs.place_guess || "",
        sonogramUrl: "",
        source: "inaturalist",
      });
      usedUsers.add(userId);
    }

    return selected;
  } catch {
    return [];
  }
}

// Salamander families that don't vocalize
const SILENT_FAMILIES = [
  "Plethodontidae",   // lungless salamanders
  "Salamandridae",    // newts and true salamanders
  "Ambystomatidae",   // mole salamanders
  "Proteidae",        // mudpuppies
];

async function main() {
  console.log("\n=== Stage 8: Fetch Amphibian Audio ===\n");

  const pipelineDir = path.join(process.cwd(), "data", "pipeline", "amphibians");
  const speciesListPath = path.join(pipelineDir, "species-enriched.json");

  if (!fs.existsSync(speciesListPath)) {
    console.error("No amphibian species list found. Run the amphibian pipeline first.");
    process.exit(1);
  }

  const speciesList: (PipelineSpecies & { familyName?: string })[] = JSON.parse(
    fs.readFileSync(speciesListPath, "utf-8")
  );

  console.log(`Found ${speciesList.length} amphibian species`);

  const audioOutputPath = path.join(pipelineDir, "audio.json");
  let audioData: Record<string, AudioEntry[]> = {};

  let fetched = 0;
  let fromXC = 0;
  let fromINat = 0;
  let skippedSilent = 0;
  let noResults = 0;
  let errors = 0;

  for (const species of speciesList) {
    const taxonKey = species.taxonId.toString();

    // Check cache
    const cacheKey = `${CACHE_NAMESPACE}_${taxonKey}`;
    const cachedResult = getCached<AudioEntry[]>(CACHE_NAMESPACE, cacheKey);
    if (cachedResult !== null) {
      audioData[taxonKey] = cachedResult;
      fetched++;
      continue;
    }

    // Skip salamanders (they don't vocalize)
    const isSalamander = species.commonName.toLowerCase().includes("salamander") ||
      species.commonName.toLowerCase().includes("newt") ||
      species.commonName.toLowerCase().includes("mudpuppy");

    if (isSalamander) {
      console.log(`  ⏭ ${species.commonName}: salamander/newt (no vocalizations)`);
      audioData[taxonKey] = [];
      setCache(CACHE_NAMESPACE, cacheKey, []);
      skippedSilent++;
      continue;
    }

    // Try Xeno-canto first
    let recordings = await fetchFromXenoCanto(species.scientificName);
    await sleep(RATE_LIMIT_MS);

    if (recordings.length > 0) {
      fromXC++;
    } else {
      // Fallback to iNaturalist
      recordings = await fetchFromINaturalist(species.taxonId);
      await sleep(RATE_LIMIT_MS);
      if (recordings.length > 0) {
        fromINat++;
      }
    }

    audioData[taxonKey] = recordings;
    setCache(CACHE_NAMESPACE, cacheKey, recordings);

    if (recordings.length > 0) {
      console.log(
        `  ✓ ${species.commonName} (${species.scientificName}): ${recordings.length} recordings [${recordings[0].source}]`
      );
    } else {
      console.log(`  - ${species.commonName}: no recordings found`);
      noResults++;
    }

    fetched++;

    // Save progress every 10 species
    if (fetched % 10 === 0) {
      fs.writeFileSync(audioOutputPath, JSON.stringify(audioData, null, 2));
    }
  }

  // Final save
  fs.writeFileSync(audioOutputPath, JSON.stringify(audioData, null, 2));

  const withAudio = Object.values(audioData).filter((a) => a.length > 0).length;
  console.log(`\n=== Amphibian Audio Fetch Complete ===`);
  console.log(`  Total species: ${speciesList.length}`);
  console.log(`  With audio: ${withAudio}`);
  console.log(`  From Xeno-canto: ${fromXC}`);
  console.log(`  From iNaturalist: ${fromINat}`);
  console.log(`  Skipped (silent): ${skippedSilent}`);
  console.log(`  No results: ${noResults}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Output: ${audioOutputPath}\n`);
}

main().catch(console.error);
