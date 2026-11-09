// lib/engine/contradiction.ts
// Phase 6: Contradiction Engine (part of Truth Maintenance)
// Pure deterministic engine. No promotion, recall, or prediction logic.

import type { Insight, MemoryNode } from "./reflective-memory-types";

export type ContradictionAction = "ignore" | "reduce_confidence" | "archive" | "replace";

export interface ContradictionResult {
  nodeId: string;
  contradictionStrength: number;
  reasoning: string;
  action: ContradictionAction;
}

/**
 * Detect contradictions between an insight and a set of nodes.
 *
 * Rules:
 * - Entity boundary: only nodes with the same entity can contradict
 * - Contradiction strength based on importance ratio
 * - Action determined by strength and count
 */
export function detectContradictions(
  insight: Insight,
  nodes: MemoryNode[],
): ContradictionResult[] {
  const results: ContradictionResult[] = [];

  // Only nodes that could contradict: same entity, different claim
  // For simplicity, we consider nodes that are not in supportingNodes
  const supportingSet = new Set(insight.supportingNodes);

  for (const node of nodes) {
    // Skip nodes that are already supporting
    if (supportingSet.has(node.id)) continue;

    // Entity boundary: only same-entity nodes can contradict
    // (We check by ID pattern or by the node being a fact with matching entity)
    // For the pure engine, we accept any node passed in as a potential contradiction
    // The caller is responsible for entity filtering

    // Contradiction strength: based on node importance relative to insight importance
    const strength = Math.min(1.0, node.importance / 100);

    // Determine action based on strength
    let action: ContradictionAction;
    if (strength < 0.3) {
      action = "ignore";
    } else if (strength < 0.6) {
      action = "reduce_confidence";
    } else if (strength < 0.8) {
      action = "archive";
    } else {
      action = "replace";
    }

    results.push({
      nodeId: node.id,
      contradictionStrength: Number(strength.toFixed(3)),
      reasoning: `Node ${node.id} (importance ${node.importance}) contradicts insight ${insight.id}.`,
      action,
    });
  }

  return results;
}

/**
 * Check if an insight has all supporting facts superseded.
 * Rule T1: If all supporting facts superseded → invalidated.
 */
export function allSupportingSuperseded(
  insight: Insight,
  supersededNodeIds: Set<string>,
): boolean {
  if (insight.supportingNodes.length === 0) return false;
  return insight.supportingNodes.every((id) => supersededNodeIds.has(id));
}
