/**
 * Stage 9: Fetch insect audio from Xeno-canto + iNaturalist
 *
 * Targets sound-producing insect families:
 *   - Gryllidae (true crickets)
 *   - Tettigoniidae (katydids/bush-crickets)
 *   - Oecanthidae (tree crickets)
 *   - Acrididae (grasshoppers — some stridulate)
 *   - Gryllotalpidae (mole crickets)
 *   - Trigonidiidae (trigs/bush crickets)
 *   - Rhaphidophoridae (camel crickets — rarely vocalize, but check)
 *   - Myrmecophilidae (ant crickets)
 *   - Gryllacrididae (leaf-roller crickets)
 *   - Mogoplistidae (scaly crickets)
 *   - Tridactylidae (pygmy mole grasshoppers)
 *   - Cicadidae (cicadas)
 *   - Tetrigidae (pygmy grasshoppers — rarely vocalize)
 *
 * Xeno-canto uses grp:grasshoppers for Orthoptera recordings.
 * Falls back to iNaturalist sound observations.
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
  familyName?: string;
}

const XENO_CANTO_API = "https://xeno-canto.org/api/3/recordings";
const XENO_CANTO_KEY = process.env.XENO_CANTO_API_KEY;
const INAT_API = "https://api.inaturalist.org/v1/observations";
const CACHE_NAMESPACE = "insect_audio";
const RATE_LIMIT_MS = 1100;

// Families known to produce identifiable sounds
const SOUND_PRODUCING_FAMILIES = new Set([
  "Gryllidae",          // true crickets
  "Tettigoniidae",      // katydids
  "Oecanthidae",        // tree crickets
  "Acrididae",          // grasshoppers (some stridulate)
  "Gryllotalpidae",     // mole crickets
  "Trigonidiidae",      // trigs / bush crickets
  "Rhaphidophoridae",   // camel crickets (unlikely but check)
  "Myrmecophilidae",    // ant crickets
  "Gryllacrididae",     // leaf-roller crickets
  "Mogoplistidae",      // scaly crickets
  "Tridactylidae",      // pygmy mole grasshoppers
  "Cicadidae",          // cicadas
  "Romaleidae",         // lubber grasshoppers (some stridulate)
  "Tetrigidae",         // pygmy grasshoppers (unlikely)
]);

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

/** Determine the sound type label based on family */
function getSoundType(familyName: string): { type: string; label: string } {
  switch (familyName) {
    case "Gryllidae":
    case "Oecanthidae":
    case "Trigonidiidae":
    case "Myrmecophilidae":
    case "Gryllacrididae":
    case "Mogoplistidae":
      return { type: "song", label: "Song" };
    case "Tettigoniidae":
      return { type: "song", label: "Song" };
    case "Cicadidae":
      return { type: "call", label: "Call" };
    case "Gryllotalpidae":
      return { type: "song", label: "Song" };
    case "Acrididae":
    case "Romaleidae":
    case "Tridactylidae":
    case "Tetrigidae":
      return { type: "stridulation", label: "Stridulation" };
    default:
      return { type: "song", label: "Song" };
  }
}

/** Try Xeno-canto for insect recordings (grp:grasshoppers covers Orthoptera) */
async function fetchFromXenoCanto(scientificName: string): Promise<AudioEntry[]> {
  if (!XENO_CANTO_KEY) return [];

  const parts = scientificName.split(" ");
  const genus = parts[0] || "";
  const species = parts[1] || "";
  // Xeno-canto uses grp:grasshoppers for all Orthoptera (crickets, katydids, grasshoppers)
  const query = `gen:${genus} sp:${species} grp:grasshoppers q_gt:C`;
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
      return (aDur >= 5 && aDur <= 120 ? 0 : 1) - (bDur >= 5 && bDur <= 120 ? 0 : 1);
    });

    // Pick up to 3 recordings from different recordists
    const selected: AudioEntry[] = [];
    const usedRecordists = new Set<string>();

    for (const rec of sorted) {
      if (selected.length >= 3) break;
      if (usedRecordists.has(rec.rec) && selected.length > 0) continue;

      // Determine type from Xeno-canto type field or use family default
      const xcType = (rec.type || "").toLowerCase();
      let type = "song";
      let label: string;

      if (xcType.includes("song") || xcType.includes("stridulation")) {
        type = xcType.includes("stridulation") ? "stridulation" : "song";
      }

      if (selected.length === 0) {
        label = type === "stridulation" ? "Stridulation" : "Song";
      } else {
        label = type === "stridulation"
          ? `Stridulation ${selected.length + 1}`
          : `Song ${selected.length + 1}`;
      }

      selected.push({
        xenoCantoId: rec.id,
        type,
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
async function fetchFromINaturalist(taxonId: number, familyName: string): Promise<AudioEntry[]> {
  const url = `${INAT_API}?taxon_id=${taxonId}&sounds=true&quality_grade=research&per_page=20&order_by=votes`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const observations = data.results || [];
    if (observations.length === 0) return [];

    const { type, label: baseLabel } = getSoundType(familyName);
    const selected: AudioEntry[] = [];
    const usedUsers = new Set<string>();

    for (const obs of observations) {
      if (selected.length >= 3) break;
      const sounds = obs.sounds || [];
      if (sounds.length === 0) continue;

      const sound = sounds[0];
      if (!sound.license_code || sound.license_code === "") continue;

      const userId = obs.user?.login || "";
      if (usedUsers.has(userId) && selected.length > 0) continue;

      const label = selected.length === 0 ? baseLabel : `${baseLabel} ${selected.length + 1}`;
      selected.push({
        iNatObservationId: String(obs.id),
        type,
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

async function main() {
  console.log("\n=== Stage 9: Fetch Insect Audio ===\n");

  const pipelineDir = path.join(process.cwd(), "data", "pipeline", "insects");
  const speciesListPath = path.join(pipelineDir, "species-enriched.json");

  if (!fs.existsSync(speciesListPath)) {
    console.error("No insect species list found. Run the insect pipeline first.");
    process.exit(1);
  }

  const speciesList: PipelineSpecies[] = JSON.parse(
    fs.readFileSync(speciesListPath, "utf-8")
  );

  console.log(`Found ${speciesList.length} insect species`);

  // Filter to sound-producing families
  const soundSpecies = speciesList.filter(
    (s) => s.familyName && SOUND_PRODUCING_FAMILIES.has(s.familyName)
  );
  const silentSpecies = speciesList.filter(
    (s) => !s.familyName || !SOUND_PRODUCING_FAMILIES.has(s.familyName)
  );

  console.log(`Sound-producing families: ${soundSpecies.length} species`);
  console.log(`Silent families (skipping): ${silentSpecies.length} species\n`);

  const audioOutputPath = path.join(pipelineDir, "audio.json");
  const audioData: Record<string, AudioEntry[]> = {};

  // Pre-populate silent species with empty arrays
  for (const s of silentSpecies) {
    const taxonKey = s.taxonId.toString();
    audioData[taxonKey] = [];
  }

  let fetched = 0;
  let cached = 0;
  let fromXC = 0;
  let fromINat = 0;
  let noResults = 0;

  for (const species of soundSpecies) {
    const taxonKey = species.taxonId.toString();

    // Check cache
    const cacheKey = `${CACHE_NAMESPACE}_${taxonKey}`;
    const cachedResult = getCached<AudioEntry[]>(CACHE_NAMESPACE, cacheKey);
    if (cachedResult !== null) {
      audioData[taxonKey] = cachedResult;
      cached++;
      continue;
    }

    // Try Xeno-canto first
    let recordings = await fetchFromXenoCanto(species.scientificName);
    await sleep(RATE_LIMIT_MS);

    if (recordings.length > 0) {
      fromXC++;
    } else {
      // Fallback to iNaturalist
      recordings = await fetchFromINaturalist(species.taxonId, species.familyName || "");
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
      console.log(`  [saved progress: ${fetched}/${soundSpecies.length}]`);
    }
  }

  // Final save
  fs.writeFileSync(audioOutputPath, JSON.stringify(audioData, null, 2));

  const withAudio = Object.values(audioData).filter((a) => a.length > 0).length;
  console.log(`\n=== Insect Audio Fetch Complete ===`);
  console.log(`  Total species: ${speciesList.length}`);
  console.log(`  Sound-producing families checked: ${soundSpecies.length}`);
  console.log(`  Cached (skipped): ${cached}`);
  console.log(`  With audio: ${withAudio}`);
  console.log(`  From Xeno-canto: ${fromXC}`);
  console.log(`  From iNaturalist: ${fromINat}`);
  console.log(`  No results: ${noResults}`);
  console.log(`  Output: ${audioOutputPath}\n`);
}

main().catch(console.error);
