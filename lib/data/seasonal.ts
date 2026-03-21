import fs from "fs";
import path from "path";
import type { SeasonalGuide, MonthlyGuide } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getSeasonalGuide(group: string = "plants"): SeasonalGuide | null {
  const groupPath = path.join(DATA_DIR, `seasonal-guide-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  return null;
}

export function getMonthlyGuide(): MonthlyGuide | null {
  const filePath = path.join(DATA_DIR, "monthly-guide.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
