import { describe, expect, it } from "vitest";
import { SESSIONS_DDL } from "../pg-lifecycle";

describe("SESSIONS_DDL", () => {
  it("creates sessions table with correct columns", () => {
    expect(SESSIONS_DDL).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(SESSIONS_DDL).toContain("session_id TEXT NOT NULL");
    expect(SESSIONS_DDL).toContain("cwd TEXT NOT NULL");
    expect(SESSIONS_DDL).toContain("last_activity_at TIMESTAMPTZ");
    expect(SESSIONS_DDL).toContain("bank_id TEXT NOT NULL");
    expect(SESSIONS_DDL).toContain("project_name TEXT");
    expect(SESSIONS_DDL).toContain("message_count INTEGER");
  });

  it("creates indexes for bank and tenant activity queries", () => {
    expect(SESSIONS_DDL).toContain("idx_sessions_bank_activity");
    expect(SESSIONS_DDL).toContain("idx_sessions_tenant_activity");
  });

  it("has primary key on (tenant_id, session_id)", () => {
    expect(SESSIONS_DDL).toContain("PRIMARY KEY (tenant_id, session_id)");
  });
});
