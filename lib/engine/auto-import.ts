import { createHash } from "crypto";
import { readdirSync, statSync, readFileSync } from "fs";
import { join, extname } from "path";

export interface AutoImportConfig {
  enabled: boolean;
  watchPath: string;
  pollIntervalMs: number;
}

export interface WatchedFile {
  path: string;
  hash: string;
  size: number;
  mtimeMs: number;
}

const WATCH_EXTS = new Set([".md", ".txt"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isDuplicateImport(hash: string, existingHashes: string[]): boolean {
  return existingHashes.includes(hash);
}

export function defaultAutoImportConfig(): AutoImportConfig {
  return { enabled: false, watchPath: "", pollIntervalMs: 5000 };
}

function walk(dir: string, out: WatchedFile[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile() && WATCH_EXTS.has(extname(name).toLowerCase())) {
      let content = "";
      try {
        content = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      out.push({ path: full, hash: computeFileHash(content), size: st.size, mtimeMs: st.mtimeMs });
    }
  }
}

export function scanDir(dir: string): WatchedFile[] {
  const out: WatchedFile[] = [];
  let st;
  try {
    st = statSync(dir);
  } catch {
    return out;
  }
  if (st.isFile()) {
    if (WATCH_EXTS.has(extname(dir).toLowerCase())) {
      const content = readFileSync(dir, "utf8");
      return [{ path: dir, hash: computeFileHash(content), size: st.size, mtimeMs: st.mtimeMs }];
    }
    return out;
  }
  walk(dir, out);
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

export function filterNew(files: WatchedFile[], knownHashes: string[]): WatchedFile[] {
  const known = new Set(knownHashes);
  return files.filter((f) => !known.has(f.hash));
}

export function buildRetainText(file: WatchedFile, content: string): string {
  return `Imported from ${file.path}:\n\n${content}`;
}