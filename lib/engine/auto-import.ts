import { createHash } from "crypto";

export interface AutoImportConfig {
  enabled: boolean;
  watchPath: string;
  pollIntervalMs: number;
}

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isDuplicateImport(hash: string, existingHashes: string[]): boolean {
  return existingHashes.includes(hash);
}

export function defaultAutoImportConfig(): AutoImportConfig {
  return { enabled: false, watchPath: "", pollIntervalMs: 5000 };
}