import { describe, expect, it } from 'vitest';
import { createUnsupportedBenchmarkResult, neutralBenchmarkSystems, normalizeBenchmarkAdapter, type NeutralMemoryAdapter } from '../../lib/runtime/neutral-memory-benchmark';

describe('neutral memory benchmark contract', () => {
  it('normalizes adapter identity and declared capabilities', () => {
    const adapter: NeutralMemoryAdapter = {
      id: 'local-postgres',
      version: 'staging',
      capabilities: { ingest: true, recall: true, correct: false, delete: true, export: false, health: true },
      async health() { return { status: 'healthy' }; },
    };

    expect(normalizeBenchmarkAdapter(adapter)).toEqual({
      id: 'local-postgres',
      version: 'staging',
      capabilities: { ingest: true, recall: true, correct: false, delete: true, export: false, health: true },
    });
  });

  it('reports unsupported operations without turning them into benchmark passes', () => {
    expect(createUnsupportedBenchmarkResult('correct')).toEqual({
      operation: 'correct',
      status: 'unsupported',
      evidence: 'NOT RUN — ADAPTER CAPABILITY REQUIRED',
    });
  });

  it('keeps unavailable comparison systems explicitly unrun', async () => {
    const systems = neutralBenchmarkSystems({ id: 'local', version: '1', capabilities: { ingest: true, recall: true, correct: true, delete: true, export: true, health: true }, async health() { return { status: 'healthy' }; } });
    expect(systems.map((system) => system.evidence)).toEqual(['BENCHMARK VERIFIED', 'NOT RUN — AUTH/ADAPTER REQUIRED', 'NOT RUN — AUTH/ADAPTER REQUIRED', 'NOT RUN — AUTH/ADAPTER REQUIRED', 'NOT RUN — AUTH/ADAPTER REQUIRED']);
  });
});
