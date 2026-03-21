import fs from "fs";
import path from "path";
import type { SpeciesData } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getAllSpeciesSlugs(): string[] {
  const speciesDir = path.join(DATA_DIR, "species");
  if (!fs.existsSync(speciesDir)) return [];
  return fs
    .readdirSync(speciesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

export function getSpecies(slug: string): SpeciesData | null {
  const filePath = path.join(DATA_DIR, "species", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getAllSpecies(): SpeciesData[] {
  const slugs = getAllSpeciesSlugs();
  return slugs
    .map((slug) => getSpecies(slug))
    .filter((s): s is SpeciesData => s !== null);
}
