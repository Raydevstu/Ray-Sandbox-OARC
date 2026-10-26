import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const launcher = join(root, "plugins", "ray-memory-os", "scripts", "ray-memory-launcher.py");

function runLauncher(mode: string, input: unknown, env: Record<string, string>) {
  const result = spawnSync("python", [launcher, mode], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(input),
    env: { ...process.env, ...env },
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim());
}

describe("repository-owned Ray Memory edge spool", () => {
  it("syncs a captured edge event to the canonical endpoint and records its acknowledgement", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "ray-memory-edge-sync-"));
    try {
      const script = `import json, sys
sys.path.insert(0, r"${join(root, "services", "memory-os")}")
from ray_memory_os import connect, capture, sync_once
conn = connect(r"${join(dataDir, "memory.sqlite3")}")
capture(conn, {"projectId": "project-1", "sessionId": "session-1", "eventType": "Stop", "content": "Use PostgreSQL as canonical storage."})
seen = []
result = sync_once(conn, lambda payload, config: seen.append(payload) or {"status": 200, "body": {"eventId": "canonical-edge-1"}}, {"tenantId": "tenant-1", "bankId": "bank-1", "projectId": "project-1"})
row = conn.execute("select sync_status, canonical_event_id from captures").fetchone()
print(json.dumps({"result": result, "payload": seen[0], "status": [row["sync_status"], row["canonical_event_id"]]}))
conn.close()`;
      const result = spawnSync("python", ["-c", script], { cwd: root, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const proof = JSON.parse(result.stdout.trim());
      expect(proof.result).toMatchObject({ processed: 1 });
      expect(proof.payload).toMatchObject({ tenantId: "tenant-1", bankId: "bank-1", projectId: "project-1", content: "Use PostgreSQL as canonical storage." });
      expect(proof.status).toEqual(["processed", "canonical-edge-1"]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("writes hook diagnostics under the configured plugin data boundary", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "ray-memory-diagnostic-"));
    try {
      runLauncher("hook", { cwd: root, projectId: "project-1", eventType: "Stop", content: "diagnostic" }, { PLUGIN_DATA: dataDir, LOCALAPPDATA: dataDir });
      const log = readFileSync(join(dataDir, "RayMemory", "hook.log"), "utf8");
      expect(log).toContain('"eventName": "Stop"');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
