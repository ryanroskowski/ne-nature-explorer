import fs from "fs";
import path from "path";
import type { SearchEntry } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getSearchIndex(group?: string): SearchEntry[] {
  if (group) {
    const groupPath = path.join(DATA_DIR, `search-index-${group}.json`);
    if (fs.existsSync(groupPath)) {
      return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
    }
    if (group === "plants") {
      const legacyPath = path.join(DATA_DIR, "search-index.json");
      if (fs.existsSync(legacyPath)) {
        return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
      }
    }
    return [];
  }

  const allEntries: SearchEntry[] = [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("search-index-") && f.endsWith(".json"));

  if (files.length > 0) {
    for (const file of files) {
      const entries: SearchEntry[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      allEntries.push(...entries);
    }
  } else {
    const legacyPath = path.join(DATA_DIR, "search-index.json");
    if (fs.existsSync(legacyPath)) {
      return JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    }
  }

  return allEntries;
}
