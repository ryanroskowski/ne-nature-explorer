import fs from "fs";
import path from "path";
import type { ContextualArticle } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getContextualArticles(): ContextualArticle[] {
  const filePath = path.join(DATA_DIR, "contextual-knowledge.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getContextualArticle(slug: string): ContextualArticle | null {
  const articles = getContextualArticles();
  return articles.find((a) => a.slug === slug) || null;
}

export function getArticlesForSpecies(speciesSlug: string): ContextualArticle[] {
  const articles = getContextualArticles();
  return articles.filter((a) => a.relatedSpeciesSlugs.includes(speciesSlug));
}
