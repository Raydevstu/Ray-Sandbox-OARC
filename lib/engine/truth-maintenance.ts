// lib/engine/truth-maintenance.ts
// Phase 6: Truth Maintenance System
// Handles reevaluation, archiving, replacement, and obsolescence.

import type { Insight, MemoryNode, TensionRecord } from "./reflective-memory-types";
import { createTensionRecord } from "./reflective-memory-types";
import { allSupportingSuperseded } from "./contradiction";

export interface ReevaluationResult {
  insight: Insight;
  archived: boolean;
  replacementCandidate: Insight | null;
  tensionRecords: TensionRecord[];
  reason: string;
}

const CONFIDENCE_ARCHIVE_THRESHOLD = 0.4;

/**
 * Reevaluate an insight given new evidence.
 * Applies rules T1, T2, T3.
 */
export function reevaluateInsight(
  insight: Insight,
  contradictingNodes: MemoryNode[],
  supersededNodeIds: Set<string> = new Set(),
  tenantId: string = insight.tenantId,
  bankId: string = insight.bankId,
): ReevaluationResult {
  const tensionRecords: TensionRecord[] = [];
  let archived = false;
  let replacementCandidate: Insight | null = null;
  let reason = "No changes needed.";

  // T1: All supporting facts superseded → invalidated
  if (allSupportingSuperseded(insight, supersededNodeIds)) {
    const updatedInsight: Insight = {
      ...insight,
      status: "invalidated",
      lastValidatedAt: new Date(),
    };
    return {
      insight: updatedInsight,
      archived: true,
      replacementCandidate: null,
      tensionRecords: [],
      reason: "All supporting facts superseded. Insight invalidated.",
    };
  }

  // Create tension records for contradicting nodes
  for (const node of contradictingNodes) {
    const strength = Math.min(1.0, node.importance / 100);
    if (strength >= 0.3) {
      tensionRecords.push(
        createTensionRecord({
          id: `tension-${insight.id}-${node.id}`,
          tenantId,
          bankId,
          insightId: insight.id,
          contradictingNodeIds: [node.id],
          contradictionStrength: Number(strength.toFixed(3)),
        }),
      );
    }
  }

  // T3: Direct opposition → archive + create replacement candidate
  const strongContradictions = contradictingNodes.filter(
    (n) => n.importance / 100 >= 0.6,
  );
  if (strongContradictions.length > 0 && insight.status === "active") {
    archived = true;
    const updatedInsight: Insight = {
      ...insight,
      status: "archived",
      lastValidatedAt: new Date(),
    };

    // Create replacement candidate
    replacementCandidate = {
      ...insight,
      id: `${insight.id}-replacement`,
      status: "candidate",
      supportingNodes: strongContradictions.map((n) => n.id),
      contradictingNodes: insight.supportingNodes,
      confidence: 0.3,
      stability: 0.5,
      createdAt: new Date(),
      lastValidatedAt: new Date(),
    };

    reason = "Strong contradictions detected. Insight archived, replacement candidate created.";
    return {
      insight: updatedInsight,
      archived,
      replacementCandidate,
      tensionRecords,
      reason,
    };
  }

  // T2: Confidence < 0.4 → archived
  if (insight.confidence < CONFIDENCE_ARCHIVE_THRESHOLD && insight.status === "active") {
    archived = true;
    const updatedInsight: Insight = {
      ...insight,
      status: "archived",
      lastValidatedAt: new Date(),
    };
    reason = `Confidence ${insight.confidence} below threshold ${CONFIDENCE_ARCHIVE_THRESHOLD}. Archived.`;
    return {
      insight: updatedInsight,
      archived,
      replacementCandidate: null,
      tensionRecords,
      reason,
    };
  }

  return {
    insight,
    archived: false,
    replacementCandidate: null,
    tensionRecords,
    reason,
  };
}

/**
 * Archive an obsolete insight (status → archived).
 * Rule TMS-1: retains full evidence graph.
 */
export function archiveObsoleteInsight(insight: Insight): Insight {
  return {
    ...insight,
    status: "archived",
    lastValidatedAt: new Date(),
  };
}

/**
 * Create a replacement candidate insight.
 * Links via supersedes (handled by caller via evidence graph).
 */
export function createReplacementCandidate(
  oldInsight: Insight,
  newSupportingNodes: string[],
): Insight {
  return {
    ...oldInsight,
    id: `${oldInsight.id}-replacement`,
    status: "candidate",
    supportingNodes: newSupportingNodes,
    contradictingNodes: oldInsight.supportingNodes,
    confidence: 0.3,
    stability: 0.5,
    createdAt: new Date(),
    lastValidatedAt: new Date(),
  };
}

/**
 * Find obsolete insights: active insights whose supporting facts are all superseded.
 */
export function findObsoleteInsights(
  insights: Insight[],
  supersededNodeIds: Set<string>,
): Insight[] {
  return insights.filter(
    (ins) => ins.status === "active" && allSupportingSuperseded(ins, supersededNodeIds),
  );
}

// Re-export from contradiction module for convenience
export { allSupportingSuperseded } from "./contradiction";
