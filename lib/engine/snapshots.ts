import type { Bank, EvalRun, GraphLink, MemoryFact, Observation, Opinion } from "@/lib/types";
import { countTokens, uid } from "@/lib/utils";

export interface SnapshotData {
  banks: Bank[]; facts: MemoryFact[]; links: GraphLink[]; observations: Observation[]; opinions: Opinion[]; evalRuns: EvalRun[];
}
export interface MemorySnapshot { id: string; name: string; createdAt: string; reason?: string; data: SnapshotData; checksum: string; }
export interface SnapshotDiff { addedFacts: string[]; removedFacts: string[]; changedFacts: string[]; addedLinks: number; removedLinks: number; evalRunsAdded: number; }
export interface RebuildReport { factCount: number; linkCount: number; entityCount: number; tokenCount: number; rebuiltAt: string; }

function stable(value: unknown): string { return JSON.stringify(value, Object.keys((value ?? {}) as object).sort()); }
function checksum(data: SnapshotData): string { let hash = 2166136261; for (const char of stable(data)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16); }
export function createSnapshot(name: string, data: SnapshotData, reason?: string): MemorySnapshot { return { id: uid("snapshot"), name: name.trim() || "Untitled snapshot", createdAt: new Date().toISOString(), reason, data, checksum: checksum(data) }; }
export function diffSnapshots(before: SnapshotData, after: SnapshotData): SnapshotDiff {
  const previous = new Map(before.facts.map((fact) => [fact.id, JSON.stringify(fact)])); const next = new Map(after.facts.map((fact) => [fact.id, JSON.stringify(fact)]));
  return { addedFacts: [...next.keys()].filter((id) => !previous.has(id)), removedFacts: [...previous.keys()].filter((id) => !next.has(id)), changedFacts: [...next.keys()].filter((id) => previous.has(id) && previous.get(id) !== next.get(id)), addedLinks: Math.max(0, after.links.length - before.links.length), removedLinks: Math.max(0, before.links.length - after.links.length), evalRunsAdded: Math.max(0, after.evalRuns.length - before.evalRuns.length) };
}
export function rebuildIndexes(data: SnapshotData): RebuildReport {
  const entities = new Set(data.facts.flatMap((fact) => fact.entities.map((entity) => entity.toLowerCase())));
  return { factCount: data.facts.length, linkCount: data.links.length, entityCount: entities.size, tokenCount: data.facts.reduce((total, fact) => total + (fact.tokens || countTokens(fact.text)), 0), rebuiltAt: new Date().toISOString() };
}
