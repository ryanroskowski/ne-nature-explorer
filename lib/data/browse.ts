import fs from "fs";
import path from "path";
import type { BrowseEntry } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getBrowseIndex(group: string = "plants"): BrowseEntry[] {
  const groupPath = path.join(DATA_DIR, `browse-index-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  if (group === "plants") {
    const legacyPath = path.join(DATA_DIR, "browse-index.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }
  return [];
}
