import fs from "fs";
import path from "path";
import type { CommonalityEntry } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getCommonality(group: string = "plants"): CommonalityEntry[] {
  const groupPath = path.join(DATA_DIR, `commonality-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  return [];
}
