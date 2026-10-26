import type { CanonicalRepository } from './repositories/interfaces';
import { resolveGraphEntity, traverseTypedGraph, type GraphResolution, type GraphTraversalOptions, type GraphTraversalResult } from './typed-graph';
import type { MemoryScope } from './contracts';

export type GraphExplanationHop = Readonly<{ edgeId: string; from: string; to: string; relation: string; evidenceIds: readonly string[]; validFrom: string; validTo: string | null }>;
export type GraphExplanation = Readonly<{ startEntityId: string | null; at: string; paths: readonly (readonly GraphExplanationHop[])[] }>;
export type TypedGraphRetrieval = Readonly<{ resolution: GraphResolution; results: readonly GraphTraversalResult[]; explanation: GraphExplanation; conflicts: Awaited<ReturnType<CanonicalRepository['listGraphConflicts']>> }>;

export async function retrieveTypedGraph(repository: CanonicalRepository, scope: MemoryScope, startLabel: string, options: GraphTraversalOptions): Promise<TypedGraphRetrieval> {
  const graph = await repository.listGraph(scope);
  const resolution = resolveGraphEntity(graph.entities, startLabel);
  if (resolution.status !== 'resolved') return { resolution, results: [], explanation: { startEntityId: null, at: options.at, paths: [] }, conflicts: await repository.listGraphConflicts(scope) };
  const entityId = resolution.entityId;
  if (!entityId) return { resolution, results: [], explanation: { startEntityId: null, at: options.at, paths: [] }, conflicts: await repository.listGraphConflicts(scope) };
  const results = traverseTypedGraph(graph.entities, graph.edges, entityId, options);
  const paths = results.filter((result) => result.hops === options.maxHops).map((result) => result.path.map((edge) => ({ edgeId: edge.id, from: edge.from, to: edge.to, relation: edge.type, evidenceIds: edge.evidenceIds, validFrom: edge.validFrom, validTo: edge.validTo })));
  return { resolution, results, explanation: { startEntityId: resolution.entityId, at: options.at, paths }, conflicts: await repository.listGraphConflicts(scope) };
}
