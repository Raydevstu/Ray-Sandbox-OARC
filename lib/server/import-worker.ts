import { readFileSync } from "fs";
import { scanDir, filterNew, buildRetainText, type WatchedFile } from "../engine/auto-import";
import { extractFacts, buildLinks } from "../engine/retain";
import { saveDistilledFacts, type PgPool } from "./pg-lifecycle";
import { distillSession } from "../engine/distillation";

export interface ImportResult {
  scanned: number;
  imported: number;
  hashes: string[];
}

export async function importOnce(
  pool: PgPool,
  tenantId: string,
  bankId: string,
  dir: string,
  knownHashes: string[]
): Promise<ImportResult> {
  const scanned = scanDir(dir);
  const fresh = filterNew(scanned, knownHashes);
  const hashes = [...knownHashes];
  let imported = 0;

  for (const file of fresh) {
    let content = "";
    try {
      content = readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    const text = buildRetainText(file, content);
    const { facts } = extractFacts(text, {
      bankId,
      scopes: { userId: "import", agentId: "auto-import", appId: "watcher", runId: `import-${Date.now()}` },
    });
    const distilled = distillSession({
      task: `Import ${file.path}`,
      events: facts.map((f) => ({ type: "FILE_VIEWED" as const, file: file.path, timestamp: Date.now(), content: f.text })),
      findings: facts.map((f) => f.text),
      resolution: "",
    });
    void buildLinks;
    await saveDistilledFacts(
      pool,
      tenantId,
      bankId,
      distilled.map((d) => ({ ...d, provenance: { source: "auto-import", createdAt: Date.now() } }))
    );
    hashes.push(file.hash);
    imported++;
  }

  return { scanned: scanned.length, imported, hashes };
}

export type { WatchedFile };
