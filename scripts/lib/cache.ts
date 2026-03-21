import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache");

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(namespace: string, key: string): string {
  const hash = crypto.createHash("md5").update(key).digest("hex");
  return path.join(CACHE_DIR, `${namespace}_${hash}.json`);
}

export function getCached<T>(namespace: string, key: string): T | null {
  const filePath = cacheKey(namespace, key);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  }
  return null;
}

export function setCache<T>(namespace: string, key: string, data: T): void {
  ensureCacheDir();
  const filePath = cacheKey(namespace, key);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function clearCache(namespace?: string): void {
  if (!fs.existsSync(CACHE_DIR)) return;
  const files = fs.readdirSync(CACHE_DIR);
  for (const file of files) {
    if (!namespace || file.startsWith(`${namespace}_`)) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }
  }
}
