/**
 * Build a small North American basemap GeoJSON for range-map rendering.
 *
 * Input (from .cache/basemap/, downloaded from Natural Earth):
 *   - ne_50m_admin_0_countries.geojson  (world countries)
 *   - ne_50m_admin_1_states_provinces.geojson  (states/provinces)
 *
 * Output (in data/basemap/na-basemap.json):
 *   {
 *     countries: FeatureCollection<Polygon>,  // US, CA, MX — for Mexico background
 *     states:    FeatureCollection<Polygon>,  // US + Canadian provinces
 *     neStates:  FeatureCollection<Polygon>,  // New England states highlight
 *   }
 *
 * Simplified with Douglas-Peucker (tolerance 0.02°) to keep the shipped
 * file under ~400KB while retaining good visual fidelity at map sizes.
 *
 * Run with: npx tsx scripts/build-basemap.ts
 */

import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

const CACHE_DIR = path.join(process.cwd(), ".cache", "basemap");
const OUTPUT_DIR = path.join(process.cwd(), "data", "basemap");

const NE_STATES = new Set([
  "Connecticut",
  "Maine",
  "Massachusetts",
  "New Hampshire",
  "Rhode Island",
  "Vermont",
]);

type AnyFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function simplify(feature: AnyFeature, tolerance: number): AnyFeature {
  try {
    return turf.simplify(feature as Feature, {
      tolerance,
      highQuality: false,
    }) as AnyFeature;
  } catch {
    return feature;
  }
}

function main(): void {
  console.log("Loading Natural Earth source files...");
  const countries = loadJson<FeatureCollection<Polygon | MultiPolygon>>(
    path.join(CACHE_DIR, "ne_50m_admin_0_countries.geojson")
  );
  const states = loadJson<FeatureCollection<Polygon | MultiPolygon>>(
    path.join(CACHE_DIR, "ne_50m_admin_1_states_provinces.geojson")
  );

  // Filter countries to US, Canada, Mexico
  const naCountries = countries.features.filter((f) => {
    const iso = f.properties?.ISO_A2 as string | undefined;
    return iso === "US" || iso === "CA" || iso === "MX";
  });
  console.log(`  Countries: kept ${naCountries.length} (US/CA/MX)`);

  // Filter states to US + Canada (skip AK, HI for cleaner maps of NA eastern range)
  const naStates = states.features.filter((f) => {
    const admin = f.properties?.admin as string | undefined;
    const name = f.properties?.name as string | undefined;
    if (admin !== "United States of America" && admin !== "Canada") return false;
    // Exclude Alaska and Hawaii — our range polygons never extend there and
    // including them stretches the Albers projection awkwardly.
    if (name === "Alaska" || name === "Hawaii") return false;
    return true;
  });
  console.log(`  States: kept ${naStates.length} (US mainland + Canada)`);

  // Simplify each feature
  const simpCountries = naCountries.map((f) =>
    simplify(f as AnyFeature, 0.05)
  );
  const simpStates = naStates.map((f) => simplify(f as AnyFeature, 0.02));

  // Strip properties down to what we need to keep the file small.
  const slimCountries: FeatureCollection = {
    type: "FeatureCollection",
    features: simpCountries.map((f) => ({
      type: "Feature",
      properties: {
        iso: (f.properties?.ISO_A2 as string) ?? "",
        name: (f.properties?.NAME as string) ?? "",
      },
      geometry: f.geometry,
    })),
  };

  const slimStates: FeatureCollection = {
    type: "FeatureCollection",
    features: simpStates.map((f) => ({
      type: "Feature",
      properties: {
        name: (f.properties?.name as string) ?? "",
        admin: (f.properties?.admin as string) ?? "",
        abbr: (f.properties?.postal as string) ?? "",
      },
      geometry: f.geometry,
    })),
  };

  // NE states subset (for highlight overlay on species maps)
  const neStates: FeatureCollection = {
    type: "FeatureCollection",
    features: slimStates.features.filter(
      (f) => NE_STATES.has((f.properties as { name?: string }).name ?? "")
    ),
  };
  console.log(`  NE states: ${neStates.features.length}/6`);

  const output = {
    countries: slimCountries,
    states: slimStates,
    neStates,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, "na-basemap.json");
  fs.writeFileSync(outPath, JSON.stringify(output));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\n✓ Wrote ${outPath} (${sizeKb} KB)`);
}

main();
