import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../db/migrations/0001_canonical_memory.sql', import.meta.url), 'utf8');
const projectMigration = readFileSync(new URL('../../db/migrations/0004_project_memory.sql', import.meta.url), 'utf8');
const benchmarkMigration = readFileSync(new URL('../../db/migrations/0006_benchmark_runs.sql', import.meta.url), 'utf8');
const graphMigration = readFileSync(new URL('../../db/migrations/0009_typed_graph.sql', import.meta.url), 'utf8');
const evaluationMigration = readFileSync(new URL('../../db/migrations/0010_evaluation_replay.sql', import.meta.url), 'utf8');
const correctionMigration = readFileSync(new URL('../../db/migrations/0011_evaluation_corrections.sql', import.meta.url), 'utf8');
const promptMigration = readFileSync(new URL('../../db/migrations/0014_prompt_versions.sql', import.meta.url), 'utf8');
const workflowMigration = readFileSync(new URL('../../db/migrations/0013_workflow_runs.sql', import.meta.url), 'utf8');
const contextMigration = readFileSync(new URL('../../db/migrations/0015_context_configs.sql', import.meta.url), 'utf8');
const stagingCompose = readFileSync(new URL('../../docker-compose.staging.yml', import.meta.url), 'utf8');

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

describe('typed graph migration contract', () => {
  it('defines scoped aliases, temporal evidence-backed edges, and reviewable conflicts', () => {
    expect(graphMigration).toContain('CREATE TABLE IF NOT EXISTS entity_aliases');
    expect(graphMigration).toContain('CREATE INDEX IF NOT EXISTS entity_aliases_lookup_idx');
    expect(graphMigration).toContain('valid_from TIMESTAMPTZ');
    expect(graphMigration).toContain('evidence_ids JSONB NOT NULL');
    expect(graphMigration).toContain('CREATE TABLE IF NOT EXISTS graph_edge_evidence');
    expect(graphMigration).toContain('REFERENCES evidence(tenant_id, bank_id, id)');
    expect(graphMigration).toContain('CREATE TABLE IF NOT EXISTS graph_conflicts');
    expect(graphMigration).toContain('PRIMARY KEY (tenant_id, bank_id, conflict_key)');
  });
});

describe('evaluation and replay migration contract', () => {
  it('defines versioned manifests, durable results, and replay comparisons', () => {
    expect(evaluationMigration).toContain('CREATE TABLE IF NOT EXISTS project_evaluation_runs');
    expect(evaluationMigration).toContain('corpus_hash');
    expect(evaluationMigration).toContain('config_hash');
    expect(evaluationMigration).toContain('CREATE TABLE IF NOT EXISTS project_replay_comparisons');
    expect(correctionMigration).toContain('CREATE TABLE IF NOT EXISTS project_evaluation_corrections');
    expect(correctionMigration).toContain('CREATE TABLE IF NOT EXISTS project_workflow_replays');
  });
});

describe('prompt migration contract', () => {
  it('keeps prompt versions scoped and append-versioned', () => {
    expect(promptMigration).toContain('CREATE TABLE IF NOT EXISTS prompt_versions');
    expect(promptMigration).toContain('PRIMARY KEY (tenant_id, bank_id, project_id, prompt_id, version)');
  });
});

describe('workflow run migration contract', () => {
  it('defines scoped durable workflow correlation state', () => {
    expect(workflowMigration).toContain('CREATE TABLE IF NOT EXISTS workflow_runs');
    expect(workflowMigration).toContain('PRIMARY KEY (tenant_id, bank_id, workflow_run_id)');
    expect(workflowMigration).toContain('completed_steps JSONB');
    expect(workflowMigration).toContain('workflow_runs_project_updated_idx');
  });

  it('mounts workflow runs migration into staging PostgreSQL', () => {
    expect(stagingCompose).toContain('./db/migrations/0013_workflow_runs.sql:/docker-entrypoint-initdb.d/12-workflow-runs.sql:ro');
  });
});

describe('context config migration contract', () => {
  it('defines versioned project-scoped settings and mounts the migration', () => {
    expect(contextMigration).toContain('CREATE TABLE IF NOT EXISTS context_configs');
    expect(contextMigration).toContain('PRIMARY KEY (tenant_id, bank_id, project_id, config_id)');
    expect(contextMigration).toContain('settings JSONB NOT NULL');
    expect(stagingCompose).toContain('./db/migrations/0015_context_configs.sql:/docker-entrypoint-initdb.d/13-context-configs.sql:ro');
  });
});
