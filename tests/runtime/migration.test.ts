import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../db/migrations/0001_canonical_memory.sql', import.meta.url), 'utf8');
const projectMigration = readFileSync(new URL('../../db/migrations/0004_project_memory.sql', import.meta.url), 'utf8');
const benchmarkMigration = readFileSync(new URL('../../db/migrations/0006_benchmark_runs.sql', import.meta.url), 'utf8');

describe('canonical migration integrity', () => {
  it('enforces scoped bank, fact, evidence, and provenance foreign keys', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(migration);
    db.exec("INSERT INTO tenants VALUES ('t1', 'now'), ('t2', 'now'); INSERT INTO banks VALUES ('b1', 't1', 'now'), ('b2', 't1', 'now'), ('b1', 't2', 'now');");
    expect(() => db.exec("INSERT INTO facts VALUES ('f1', 't1', 'b2', 1, 'claim', 1, 'now');")).not.toThrow();
    expect(() => db.exec("INSERT INTO evidence VALUES ('e1', 't1', 'b2', 'src', 'content', 'prov', 'now');")).not.toThrow();
    db.exec("INSERT INTO facts VALUES ('f1', 't1', 'b1', 1, 'claim', 1, 'now'); INSERT INTO evidence VALUES ('e1', 't1', 'b1', 'src', 'content', 'prov', 'now'), ('e2', 't1', 'b2', 'src', 'content', 'prov', 'now'), ('e3', 't2', 'b1', 'src', 'content', 'prov', 'now');");
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 'e1');")).not.toThrow();
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 'e1');")).toThrow();
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 'e2');")).toThrow();
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 'e3');")).toThrow();
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 'missing');")).toThrow();
  });
});

describe('project memory migration contract', () => {
  it('defines append-only project events and canonical project records with scoped uniqueness', () => {
    expect(projectMigration).toContain('CREATE TABLE IF NOT EXISTS project_events');
    expect(projectMigration).toContain('UNIQUE (tenant_id, bank_id, project_id, sequence)');
    expect(projectMigration).toContain('CREATE TABLE IF NOT EXISTS project_memory_records');
    expect(projectMigration).toContain('PRIMARY KEY (tenant_id, bank_id, id)');
    expect(projectMigration).toContain('project_events_scope_idx');
    expect(projectMigration).toContain('project_memory_scope_idx');
  });
});

describe('benchmark persistence migration contract', () => {
  it('defines scoped durable benchmark runs and lookup ordering', () => {
    expect(benchmarkMigration).toContain('CREATE TABLE IF NOT EXISTS project_benchmark_runs');
    expect(benchmarkMigration).toContain('PRIMARY KEY (tenant_id, bank_id, id)');
    expect(benchmarkMigration).toContain('payload JSONB NOT NULL');
    expect(benchmarkMigration).toContain('project_benchmark_runs_lookup_idx');
  });
});
