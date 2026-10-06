import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../db/migrations/0001_canonical_memory.sql', import.meta.url), 'utf8');

describe('canonical migration integrity', () => {
  it('enforces scoped bank, fact, evidence, and provenance foreign keys', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(migration);
    db.exec("INSERT INTO tenants VALUES ('t1', 'now'); INSERT INTO banks VALUES ('b1', 't1', 'now');");
    expect(() => db.exec("INSERT INTO facts VALUES ('f1', 't1', 'b2', 1, 'claim', 1, 'now');")).toThrow();
    expect(() => db.exec("INSERT INTO evidence VALUES ('e1', 't1', 'b2', 'src', 'content', 'prov', 'now');")).toThrow();
    db.exec("INSERT INTO facts VALUES ('f1', 't1', 'b1', 1, 'claim', 1, 'now'); INSERT INTO evidence VALUES ('e1', 't1', 'b1', 'src', 'content', 'prov', 'now');");
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 't1', 'b2', 'e1');")).toThrow();
    db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 't1', 'b1', 'e1');");
    expect(() => db.exec("INSERT INTO fact_evidence VALUES ('t1', 'b1', 'f1', 1, 't1', 'b1', 'missing');")).toThrow();
  });
});
