import type { MemoryFactRevision, MemoryScope } from '../contracts';

export type GraphNode = Readonly<{ id: string; label: string; kind: 'fact' | 'term' }>;
export type GraphEdge = Readonly<{ id: string; from: string; to: string; kind: 'mentions' }>;
export type GraphProjection = MemoryScope & Readonly<{ nodes: readonly GraphNode[]; edges: readonly GraphEdge[]; truncated: boolean }>;

const terms = (claim: string) => [...new Set(claim.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2))];
export const buildGraphProjection = (scope: MemoryScope, facts: readonly MemoryFactRevision[], maxNodes: number): GraphProjection => {
  const scopedFacts = facts.filter((fact) => fact.tenantId === scope.tenantId && fact.bankId === scope.bankId);
  if (scopedFacts.length !== facts.length) throw new Error('scope mismatch');
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const fact of scopedFacts) {
    if (nodes.length >= maxNodes) break;
    nodes.push({ id: fact.id, label: fact.claim, kind: 'fact' });
    for (const term of terms(fact.claim)) {
      if (nodes.length >= maxNodes) break;
      const termId = `term:${term}`;
      if (!seen.has(termId)) { seen.add(termId); nodes.push({ id: termId, label: term, kind: 'term' }); }
      edges.push({ id: `${fact.id}:${termId}`, from: fact.id, to: termId, kind: 'mentions' });
    }
  }
  return { ...scope, nodes, edges, truncated: scopedFacts.length > facts.length || nodes.length >= maxNodes };
};
