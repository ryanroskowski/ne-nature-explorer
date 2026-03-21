import fs from "fs";
import path from "path";
import type { TaxonomyNode, GroupInfo } from "../types";
import { getAvailableGroups } from "./groups";

const DATA_DIR = path.join(process.cwd(), "data");

export function getTaxonomyTree(group: string = "plants"): TaxonomyNode | null {
  const groupPath = path.join(DATA_DIR, `taxonomy-${group}.json`);
  if (fs.existsSync(groupPath)) {
    return JSON.parse(fs.readFileSync(groupPath, "utf-8"));
  }
  return null;
}

export function getAllTaxonomyTrees(): { group: GroupInfo; tree: TaxonomyNode }[] {
  const groups = getAvailableGroups().filter((g) => g.status === "active");
  const results: { group: GroupInfo; tree: TaxonomyNode }[] = [];
  for (const g of groups) {
    const tree = getTaxonomyTree(g.key);
    if (tree) results.push({ group: g, tree });
  }
  return results;
}
