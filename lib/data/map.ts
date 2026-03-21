import fs from "fs";
import path from "path";
import type { NatureAreasData, SpeciesIndexData } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getNatureAreas(): NatureAreasData | null {
  const filePath = path.join(DATA_DIR, "nature-areas.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getSpeciesIndex(): SpeciesIndexData | null {
  const filePath = path.join(DATA_DIR, "nature-areas-species-index.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
