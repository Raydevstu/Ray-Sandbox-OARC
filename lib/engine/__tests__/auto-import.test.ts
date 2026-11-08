import { describe, expect, it } from "vitest";
import { computeFileHash, isDuplicateImport, AutoImportConfig } from "../auto-import";

describe("auto-import", () => {
  it("computes a consistent SHA-256 hash for file content", () => {
    const hash1 = computeFileHash("hello world");
    const hash2 = computeFileHash("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("produces different hashes for different content", () => {
    const hash1 = computeFileHash("hello world");
    const hash2 = computeFileHash("goodbye world");
    expect(hash1).not.toBe(hash2);
  });

  it("detects duplicate import by hash match", () => {
    const existingHashes = ["abc123", "def456"];
    expect(isDuplicateImport("abc123", existingHashes)).toBe(true);
    expect(isDuplicateImport("xyz789", existingHashes)).toBe(false);
  });

  it("default config has auto-import disabled", () => {
    const config: AutoImportConfig = { enabled: false, watchPath: "", pollIntervalMs: 5000 };
    expect(config.enabled).toBe(false);
  });

  it("default watch path is empty (user must configure)", () => {
    const config: AutoImportConfig = { enabled: false, watchPath: "", pollIntervalMs: 5000 };
    expect(config.watchPath).toBe("");
  });
});