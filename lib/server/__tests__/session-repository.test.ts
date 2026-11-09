import { describe, expect, it } from "vitest";
import { upsertSession, getLastProject, listRecentProjects, projectNameFromCwd } from "../session-repository";

describe("projectNameFromCwd", () => {
  it("extracts project name from cwd path", () => {
    expect(projectNameFromCwd("D:/Projects/GLM CORTEXT ORCASTRATOR")).toBe("GLM CORTEXT ORCASTRATOR");
    expect(projectNameFromCwd("C:\\Users\\kafsh")).toBe("kafsh");
    expect(projectNameFromCwd("D:/Projects/RAY SANDBOX OWEN/hindsight-memory-slice")).toBe("hindsight-memory-slice");
  });

  it("handles empty cwd", () => {
    expect(projectNameFromCwd("")).toBe("");
    expect(projectNameFromCwd("/")).toBe("");
  });
});

describe("upsertSession", () => {
  it("queries with correct ON CONFLICT for idempotent upsert", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];
    const fakePool = {
      query: async (sql: string, params: unknown[]) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      },
    };
    await upsertSession(fakePool as never, {
      sessionId: "test-123",
      tenantId: "sandbox-tenant",
      bankId: "kafsh",
      cwd: "D:/Projects/GLM CORTEXT ORCASTRATOR",
      lastActivityAt: "2026-11-09T16:00:00Z",
      messageCount: 42,
    });
    expect(capturedSql).toContain("INSERT INTO sessions");
    expect(capturedSql).toContain("ON CONFLICT (tenant_id, session_id) DO UPDATE");
    expect(capturedParams[0]).toBe("test-123");
    expect(capturedParams[1]).toBe("sandbox-tenant");
    expect(capturedParams[2]).toBe("kafsh");
    expect(capturedParams[3]).toBe("D:/Projects/GLM CORTEXT ORCASTRATOR");
    expect(capturedParams[4]).toBe("GLM CORTEXT ORCASTRATOR");
    expect(capturedParams[5]).toBe("2026-11-09T16:00:00Z");
    expect(capturedParams[6]).toBe(42);
  });
});

describe("getLastProject", () => {
  it("queries sessions ordered by last_activity_at DESC LIMIT 1", async () => {
    let capturedSql = "";
    const fakePool = {
      query: async (sql: string) => {
        capturedSql = sql;
        return { rows: [{ session_id: "s1", bank_id: "kafsh", cwd: "/proj", project_name: "proj", last_activity_at: "2026-11-09T16:00:00Z", message_count: 10 }] };
      },
    };
    const result = await getLastProject(fakePool as never, "sandbox-tenant");
    expect(capturedSql).toContain("ORDER BY last_activity_at DESC");
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe("s1");
  });

  it("returns null when no sessions", async () => {
    const fakePool = { query: async () => ({ rows: [] }) };
    const result = await getLastProject(fakePool as never, "sandbox-tenant");
    expect(result).toBeNull();
  });
});

describe("listRecentProjects", () => {
  it("queries distinct projects by recency", async () => {
    let capturedSql = "";
    const fakePool = {
      query: async (sql: string) => {
        capturedSql = sql;
        return { rows: [] };
      },
    };
    await listRecentProjects(fakePool as never, "sandbox-tenant", 5);
    expect(capturedSql).toContain("DISTINCT ON");
    expect(capturedSql).toContain("ORDER BY cwd, last_activity_at DESC");
  });
});
