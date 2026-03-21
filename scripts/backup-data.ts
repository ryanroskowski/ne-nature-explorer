/**
 * Backup data and cache to a timestamped archive.
 *
 * Usage:
 *   npx tsx scripts/backup-data.ts              # Backup both data/ and .cache/
 *   npx tsx scripts/backup-data.ts --data-only   # Backup only data/
 *   npx tsx scripts/backup-data.ts --cache-only   # Backup only .cache/
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CACHE_DIR = path.join(ROOT, ".cache");
const BACKUPS_DIR = path.join(ROOT, "backups");

function copyDirRecursive(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function main() {
  const args = process.argv.slice(2);
  const dataOnly = args.includes("--data-only");
  const cacheOnly = args.includes("--cache-only");

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  const backupDir = path.join(BACKUPS_DIR, timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`\nBacking up to: backups/${timestamp}/`);

  let totalFiles = 0;

  if (!cacheOnly) {
    console.log("  Copying data/...");
    const count = copyDirRecursive(DATA_DIR, path.join(backupDir, "data"));
    totalFiles += count;
    console.log(`    ${count} files`);
  }

  if (!dataOnly) {
    console.log("  Copying .cache/...");
    const count = copyDirRecursive(CACHE_DIR, path.join(backupDir, ".cache"));
    totalFiles += count;
    console.log(`    ${count} files`);
  }

  // Write metadata
  const meta = {
    timestamp: new Date().toISOString(),
    dataIncluded: !cacheOnly,
    cacheIncluded: !dataOnly,
    totalFiles,
  };
  fs.writeFileSync(
    path.join(backupDir, "backup-meta.json"),
    JSON.stringify(meta, null, 2)
  );

  console.log(`\nDone! ${totalFiles} files backed up.`);
}

main();
