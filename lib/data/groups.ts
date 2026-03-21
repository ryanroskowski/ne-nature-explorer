import fs from "fs";
import path from "path";
import type { GroupInfo } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getAvailableGroups(): GroupInfo[] {
  const groupsPath = path.join(DATA_DIR, "groups.json");
  if (!fs.existsSync(groupsPath)) {
    return [{ key: "plants", label: "Plants", icon: "🌿", speciesCount: 0, status: "active" }];
  }
  const groups: Record<string, GroupInfo> = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));
  return Object.values(groups);
}

export function getGroupInfo(group: string): GroupInfo | null {
  const groups = getAvailableGroups();
  return groups.find((g) => g.key === group) || null;
}
