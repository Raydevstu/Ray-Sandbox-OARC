// lib/engine/reflective-memory.ts
// Phase 3: Deterministic candidate insight generation.
// Rule R1: Pattern detection must be deterministic.
// Given the same dataset, same input = same candidate insights.

import type { Insight } from "./reflective-memory-types";
import { createInsight } from "./reflective-memory-types";

// ── Fact shape used for pattern detection ──────────────────
export interface ReflectFact {
  id: string;
  tenantId: string;
  bankId: string;
  entity: string | null;
  category: string;
  claim: string;
  importance: number;
  createdAt: Date;
  sessionId?: string;
}

export interface ReflectionClusterInput {
  id: string;
  tenantId: string;
  bankId: string;
  entity: string;
  nodeIds: string[];
  facts: ReflectFact[];
}

// ── Detection rules ────────────────────────────────────────

const MIN_RECURRING_FAILURES = 3;
const CAUSAL_WINDOW_MS = 48 * 60 * 60 * 1000;
const MIN_BEHAVIOURAL_SESSIONS = 3;
const MIN_COOCCURRENCE_TIMES = 3;

export function detectRecurringFailure(cluster: ReflectionClusterInput): Insight[] {
  const failures = cluster.facts.filter(
    (f) => f.category === "failure" && f.entity === cluster.entity,
  );
  if (failures.length < MIN_RECURRING_FAILURES) return [];

  return [
    createInsight({
      id: `insight-rf-${cluster.entity}-${cluster.id}`,
      tenantId: cluster.tenantId,
      bankId: cluster.bankId,
      type: "pattern",
      claim: `${cluster.entity}-related failures have appeared repeatedly in this project.`,
      depth: 1,
      supportingNodes: failures.map((f) => f.id),
      contradictingNodes: [],
    }),
  ];
}

export function detectDecisionFailure(cluster: ReflectionClusterInput): Insight[] {
  const results: Insight[] = [];
  const decisions = cluster.facts.filter((f) => f.category === "decision");
  const failures = cluster.facts.filter((f) => f.category === "failure");

  for (const decision of decisions) {
    for (const failure of failures) {
      if (
        failure.createdAt.getTime() > decision.createdAt.getTime() &&
        failure.createdAt.getTime() - decision.createdAt.getTime() <= CAUSAL_WINDOW_MS
      ) {
        results.push(
          createInsight({
            id: `insight-df-${decision.id}-${failure.id}`,
            tenantId: cluster.tenantId,
            bankId: cluster.bankId,
            type: "causal",
            claim: `A decision was followed by a failure within 48 hours.`,
            depth: 1,
            supportingNodes: [decision.id, failure.id],
            contradictingNodes: [],
          }),
        );
      }
    }
  }
  return results;
}

export function detectDecisionSuccess(cluster: ReflectionClusterInput): Insight[] {
  const results: Insight[] = [];
  const decisions = cluster.facts.filter((f) => f.category === "decision");
  const successes = cluster.facts.filter((f) => f.category === "success");

  for (const decision of decisions) {
    for (const success of successes) {
      if (
        success.createdAt.getTime() > decision.createdAt.getTime() &&
        success.createdAt.getTime() - decision.createdAt.getTime() <= CAUSAL_WINDOW_MS
      ) {
        results.push(
          createInsight({
            id: `insight-ds-${decision.id}-${success.id}`,
            tenantId: cluster.tenantId,
            bankId: cluster.bankId,
            type: "causal",
            claim: `A decision was followed by a success within 48 hours.`,
            depth: 1,
            supportingNodes: [decision.id, success.id],
            contradictingNodes: [],
          }),
        );
      }
    }
  }
  return results;
}

export function detectBehaviouralTendency(cluster: ReflectionClusterInput): Insight[] {
  const results: Insight[] = [];
  const byClaim = new Map<string, ReflectFact[]>();

  for (const f of cluster.facts) {
    const key = f.claim.toLowerCase().trim();
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key)!.push(f);
  }

  for (const [claim, facts] of byClaim) {
    const sessions = new Set(facts.map((f) => f.sessionId ?? f.id));
    if (sessions.size >= MIN_BEHAVIOURAL_SESSIONS) {
      results.push(
        createInsight({
          id: `insight-bt-${cluster.entity}-${claim.slice(0, 20).replace(/\s/g, "-")}`,
          tenantId: cluster.tenantId,
          bankId: cluster.bankId,
          type: "tendency",
          claim: `A recurring behavioural pattern has been observed across multiple sessions.`,
          depth: 1,
          supportingNodes: facts.map((f) => f.id),
          contradictingNodes: [],
        }),
      );
    }
  }
  return results;
}

export function detectCooccurrence(cluster: ReflectionClusterInput): Insight[] {
  const results: Insight[] = [];
  const entityPairs = new Map<string, number>();

  const factsWithEntities = cluster.facts.filter((f) => f.entity);
  for (let i = 0; i < factsWithEntities.length; i++) {
    for (let j = i + 1; j < factsWithEntities.length; j++) {
      const a = factsWithEntities[i].entity!;
      const b = factsWithEntities[j].entity!;
      if (a === b) continue;
      const key = [a, b].sort().join("::");
      entityPairs.set(key, (entityPairs.get(key) ?? 0) + 1);
    }
  }

  for (const [pair, count] of entityPairs) {
    if (count >= MIN_COOCCURRENCE_TIMES) {
      const [a, b] = pair.split("::");
      results.push(
        createInsight({
          id: `insight-co-${a}-${b}`,
          tenantId: cluster.tenantId,
          bankId: cluster.bankId,
          type: "correlation",
          claim: `${a} and ${b} frequently co-occur in this project.`,
          depth: 1,
          supportingNodes: factsWithEntities
            .filter((f) => f.entity === a || f.entity === b)
            .map((f) => f.id),
          contradictingNodes: [],
        }),
      );
    }
  }
  return results;
}

export function generateCandidateInsights(cluster: ReflectionClusterInput): Insight[] {
  const insights: Insight[] = [];

  const clusterFacts = cluster.facts.filter(
    (f) => !cluster.entity || f.entity === cluster.entity || f.entity === null,
  );

  const scopedCluster = { ...cluster, facts: clusterFacts };

  insights.push(...detectRecurringFailure(scopedCluster));
  insights.push(...detectDecisionFailure(scopedCluster));
  insights.push(...detectDecisionSuccess(scopedCluster));
  insights.push(...detectBehaviouralTendency(scopedCluster));
  insights.push(...detectCooccurrence(scopedCluster));

  const seen = new Set<string>();
  return insights.filter((ins) => {
    if (seen.has(ins.id)) return false;
    seen.add(ins.id);
    return true;
  });
}
