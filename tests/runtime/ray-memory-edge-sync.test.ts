import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
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
    const port = 39000 + Math.floor(Math.random() * 500);
    const serverScript = `import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        with open(sys.argv[2], "a", encoding="utf-8") as stream:
            stream.write(self.rfile.read(length).decode() + "\\n")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "data": {"eventId": "canonical-edge-1"}}).encode())
    def log_message(self, *_): pass
HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()`;
    const requestsFile = join(dataDir, "requests.jsonl");
    const server = spawn("python", ["-c", serverScript, String(port), requestsFile], { cwd: root });
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const common = { RAY_MEMORY_DB: join(dataDir, "memory.sqlite3"), PLUGIN_DATA: dataDir, RAY_MEMORY_PROJECT_ID: "project-1", RAY_MEMORY_TENANT_ID: "tenant-1", RAY_MEMORY_BANK_ID: "bank-1", RAY_MEMORY_ENDPOINT: `http://127.0.0.1:${port}/codex-event` };
      runLauncher("hook", { cwd: root, projectId: "project-1", eventType: "Stop", content: "Use PostgreSQL as the canonical source of truth." }, common);
      expect(runLauncher("sync", {}, common)).toMatchObject({ claimed: 1, processed: 1 });
      expect(runLauncher("sync", {}, common)).toMatchObject({ claimed: 0, processed: 0 });
      const requests = readFileSync(requestsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ tenantId: "tenant-1", bankId: "bank-1", projectId: "project-1", content: "Use PostgreSQL as the canonical source of truth." });
    } finally {
      server.kill();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("writes hook diagnostics under the configured plugin data boundary", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "ray-memory-diagnostic-"));
    try {
      runLauncher("hook", { cwd: root, projectId: "project-1", eventType: "Stop", content: "diagnostic" }, { PLUGIN_DATA: dataDir });
      const log = readFileSync(join(dataDir, "RayMemory", "hook.log"), "utf8");
      expect(log).toContain('"eventName": "Stop"');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("keeps the launcher-loaded plugin runtime identical to the service runtime", () => {
    const pluginRuntime = readFileSync(join(root, "plugins", "ray-memory-os", "scripts", "ray_memory_os.py"), "utf8").replace(/\r\n/g, "\n").trimEnd();
    const serviceRuntime = readFileSync(join(root, "services", "memory-os", "ray_memory_os.py"), "utf8").replace(/\r\n/g, "\n").trimEnd();
    expect(pluginRuntime).toBe(serviceRuntime);
  });
});
