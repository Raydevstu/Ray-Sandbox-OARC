import { stableId, type ProjectMemoryRecord } from './contracts';

export type RetrievalTraceItem = Readonly<{
  recordId: string;
  score: number;
  confidence: number;
  evidenceReferences: readonly string[];
  rationale: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectMemoryRecord['status'];
  source: ProjectMemoryRecord['source'];
}>;

export type RetrievalTrace = Readonly<{
  traceId: string;
  query: string;
  items: readonly RetrievalTraceItem[];
  gaps: readonly string[];
  policyOutcome?: 'allowed' | 'degraded';
  freshness?: 'fresh' | 'stale' | 'unknown';
  exclusions?: readonly string[];
  graphHops?: number;
}>;

const terms = (value: string): readonly string[] => [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])];

export const buildRetrievalTrace = (records: readonly ProjectMemoryRecord[], query: string, traceId = stableId('trace', query)): RetrievalTrace => {
  const queryTerms = terms(query);
  const gaps: string[] = [];
  const items = records.flatMap((record) => {
    if (!record.evidence.length) { gaps.push(`record ${record.id} has no source evidence`); return []; }
    const haystack = terms(`${record.title} ${record.content}`);
    const score = queryTerms.filter((term) => haystack.includes(term)).length / Math.max(1, queryTerms.length);
    if (!score) return [];
    return [{ recordId: record.id, score, confidence: record.confidence, evidenceReferences: record.evidence.map((item) => item.reference), rationale: `selected because ${Math.round(score * 100)}% of query terms matched`, createdAt: record.createdAt, updatedAt: record.updatedAt, status: record.status, source: record.source }];
  }).sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.recordId.localeCompare(b.recordId));
  const exclusions = records.filter((record) => !items.some((item) => item.recordId === record.id)).map((record) => `${record.id}: no query-term match or source evidence`);
  const freshness = items.length === 0 ? 'unknown' : items.some((item) => Date.now() - Date.parse(item.updatedAt) > 1000 * 60 * 60 * 24 * 30) ? 'stale' : 'fresh';
  return { traceId, query, items, gaps, policyOutcome: gaps.length ? 'degraded' : 'allowed', freshness, exclusions, graphHops: 0 };
};
