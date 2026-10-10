export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export interface TimelinePoint {
  timestamp: number;
  ingest: number;
  recall: number;
  policy: number;
}

export interface EvidenceRow {
  id: string;
  title: string;
  source: string;
  severity: Exclude<SeverityFilter, 'all'>;
  confidence: number;
  updatedAt: number;
  summary: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  kind: 'source' | 'memory' | 'policy' | 'conflict';
  x: number;
  y: number;
  summary: string;
}

export interface TopologyEdge {
  from: string;
  to: string;
}

export interface GallerySnapshot {
  label: 'Synthetic preview data';
  lastUpdatedAt: number;
  tick: number;
  timeline: readonly TimelinePoint[];
  evidenceRows: readonly EvidenceRow[];
  topologyNodes: readonly TopologyNode[];
  topologyEdges: readonly TopologyEdge[];
}

const timelineLength = 18;

function seededValue(seed: number, index: number, offset: number) {
  return 18 + ((seed * 17 + index * 23 + offset * 31) % 44);
}

export function createGallerySnapshot(seed = 1): GallerySnapshot {
  const now = 1_728_000_000_000 + seed * 1_000;
  const timeline = Array.from({ length: timelineLength }, (_, index) => ({
    timestamp: now - (timelineLength - index - 1) * 60_000,
    ingest: seededValue(seed, index, 0),
    recall: seededValue(seed, index, 1),
    policy: seededValue(seed, index, 2),
  }));

  return {
    label: 'Synthetic preview data',
    lastUpdatedAt: now,
    tick: 0,
    timeline,
    evidenceRows: [
      { id: 'evt-91a', title: 'Retention policy superseded', source: 'project-memory', severity: 'warning', confidence: 0.91, updatedAt: now - 60_000, summary: 'A newer retention policy revision requires review.' },
      { id: 'evt-91b', title: 'Recall path exceeded budget', source: 'retrieval-trace', severity: 'critical', confidence: 0.84, updatedAt: now - 120_000, summary: 'The synthetic recall path crossed the configured cost threshold.' },
      { id: 'evt-91c', title: 'Provenance coverage recovered', source: 'event-ledger', severity: 'info', confidence: 0.98, updatedAt: now - 180_000, summary: 'All synthetic records in this sample have source references.' },
      { id: 'evt-91d', title: 'Conflict review assigned', source: 'governance', severity: 'warning', confidence: 0.88, updatedAt: now - 240_000, summary: 'A synthetic conflict is ready for operator review.' },
    ],
    topologyNodes: [
      { id: 'source', label: 'Source event', kind: 'source', x: 14, y: 52, summary: 'Immutable synthetic source event.' },
      { id: 'memory', label: 'Memory revision', kind: 'memory', x: 42, y: 30, summary: 'Derived synthetic memory with source linkage.' },
      { id: 'policy', label: 'Policy gate', kind: 'policy', x: 68, y: 30, summary: 'Synthetic policy decision boundary.' },
      { id: 'conflict', label: 'Conflict review', kind: 'conflict', x: 72, y: 72, summary: 'Synthetic reviewable disagreement.' },
      { id: 'recall', label: 'Recall trace', kind: 'memory', x: 42, y: 76, summary: 'Synthetic retrieval explanation.' },
    ],
    topologyEdges: [
      { from: 'source', to: 'memory' },
      { from: 'source', to: 'recall' },
      { from: 'memory', to: 'policy' },
      { from: 'recall', to: 'conflict' },
      { from: 'policy', to: 'conflict' },
    ],
  };
}

export function advanceGallerySnapshot(snapshot: GallerySnapshot): GallerySnapshot {
  const tick = snapshot.tick + 1;
  const lastPoint = snapshot.timeline.at(-1) ?? { timestamp: snapshot.lastUpdatedAt, ingest: 0, recall: 0, policy: 0 };
  const nextPoint = {
    timestamp: lastPoint.timestamp + 60_000,
    ingest: Math.max(8, lastPoint.ingest + ((tick * 7) % 13) - 6),
    recall: Math.max(8, lastPoint.recall + ((tick * 11) % 15) - 7),
    policy: Math.max(8, lastPoint.policy + ((tick * 5) % 11) - 5),
  };

  return {
    ...snapshot,
    tick,
    lastUpdatedAt: snapshot.lastUpdatedAt + 60_000,
    timeline: [...snapshot.timeline.slice(1), nextPoint],
  };
}

export function filterEvidenceRows(rows: readonly EvidenceRow[], query: string, severity: SeverityFilter): EvidenceRow[] {
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) =>
    (severity === 'all' || row.severity === severity) &&
    (!normalized || `${row.title} ${row.source} ${row.summary}`.toLowerCase().includes(normalized))
  );
}

export function sortEvidenceRows(rows: readonly EvidenceRow[], field: 'confidence' | 'updatedAt'): EvidenceRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => right.row[field] - left.row[field] || left.index - right.index)
    .map(({ row }) => row);
}

export function resolveSelectedEvidenceRow(rows: readonly EvidenceRow[], selectedId: string | null): EvidenceRow | null {
  return rows.find((row) => row.id === selectedId) ?? null;
}

export function resolveTopologySelection(nodes: readonly TopologyNode[], selectedId: string | null): TopologyNode | null {
  return nodes.find((node) => node.id === selectedId) ?? null;
}
