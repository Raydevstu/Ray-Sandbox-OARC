export type GraphEntityType = 'person' | 'project' | 'technology' | 'organization' | 'concept' | 'unknown';
export type GraphEntity = Readonly<{ id: string; label: string; type: GraphEntityType; aliases?: readonly string[] }>;
export type GraphEdge = Readonly<{ id: string; from: string; to: string; type: string; validFrom: string; validTo: string | null; evidenceIds: readonly string[]; state?: 'active' | 'superseded' | 'review' | 'invalid' }>;
export type GraphResolution = Readonly<{ status: 'resolved' | 'ambiguous' | 'unresolved'; entityId: string | null; candidateIds: readonly string[] }>;
export type GraphConflict = Readonly<{ key: string; edgeIds: readonly string[]; state: 'review'; reason: 'contradictory-active-relationships' }>;
export type GraphConflictRecord = Readonly<{ key: string; edgeIds: readonly string[]; state: 'review' | 'resolved' | 'dismissed'; reason: string }>;
export type GraphTraversalOptions = Readonly<{ at: string; maxHops: number }>;
export type GraphTraversalResult = Readonly<{ entity: GraphEntity; hops: number; path: readonly GraphEdge[] }>;
export type TypedGraphRecord = Readonly<{ entity: GraphEntity; edges: readonly GraphEdge[] }>;

const validAt = (edge: GraphEdge, at: string): boolean => edge.validFrom <= at && (edge.validTo === null || edge.validTo >= at);

const normalized = (value: string): string => value.trim().toLocaleLowerCase('en-US');

export function resolveGraphEntity(entities: readonly GraphEntity[], label: string): GraphResolution {
  const target = normalized(label);
  const matches = entities
    .filter((entity) => normalized(entity.label) === target || (entity.aliases ?? []).some((alias) => normalized(alias) === target))
    .map((entity) => entity.id)
    .sort((a, b) => a.localeCompare(b));
  if (matches.length === 1) return { status: 'resolved', entityId: matches[0], candidateIds: matches };
  if (matches.length > 1) return { status: 'ambiguous', entityId: null, candidateIds: matches };
  return { status: 'unresolved', entityId: null, candidateIds: [] };
}

export function detectGraphConflicts(edges: readonly GraphEdge[]): readonly GraphConflict[] {
  const active = edges.filter((edge) => edge.state !== 'superseded' && edge.state !== 'invalid' && edge.validTo === null);
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of active) {
    const key = `${edge.from}\u0000${edge.to}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, group }))
    .filter(({ group }) => new Set(group.map((edge) => edge.type)).size > 1)
    .map(({ key, group }) => ({ key, edgeIds: group.map((edge) => edge.id).sort((a, b) => a.localeCompare(b)), state: 'review' as const, reason: 'contradictory-active-relationships' as const }));
}

export function traverseTypedGraph(entities: readonly GraphEntity[], edges: readonly GraphEdge[], startId: string, options: GraphTraversalOptions): readonly GraphTraversalResult[] {
  if (!Number.isInteger(options.maxHops) || options.maxHops < 1) throw new Error('maxHops must be positive');
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const queue: Array<{ id: string; hops: number; path: readonly GraphEdge[]; visited: ReadonlySet<string> }> = [{ id: startId, hops: 0, path: [], visited: new Set([startId]) }];
  const results: GraphTraversalResult[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.hops >= options.maxHops) continue;
    for (const edge of edges.filter((candidate) => candidate.from === current.id && validAt(candidate, options.at)).sort((a, b) => a.id.localeCompare(b.id))) {
      if (current.visited.has(edge.to)) continue;
      const entity = byId.get(edge.to);
      if (!entity) continue;
      const path = [...current.path, edge];
      const visited = new Set(current.visited).add(edge.to);
      results.push({ entity, hops: current.hops + 1, path });
      queue.push({ id: edge.to, hops: current.hops + 1, path, visited });
    }
  }
  return results;
}
