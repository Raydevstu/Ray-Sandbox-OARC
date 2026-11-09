// lib/engine/review-queue.ts
// Phase 7: Insight Review Queue
// Candidate → Verification → Promotion → Active
// OR Candidate → Rejected
// OR Candidate → Reinforce Existing Insight

import type { Insight } from "./reflective-memory-types";
import { calculateConfidence } from "./confidence";
import { calculateStability } from "./stability";

export interface VerificationResult {
  approved: boolean;
  reasons: string[];
  confidence: number;
  stability: number;
  duplicateInsightId?: string;
  budgetViolation?: boolean;
}

export interface ProcessResult {
  promoted: Insight[];
  reinforced: Insight[];
  rejected: {
    insightId: string;
    reasons: string[];
  }[];
}

const CONFIDENCE_THRESHOLD = 0.4;
const MIN_SUPPORTING_NODES = 2;
const MAX_ACTIVE_INSIGHTS = 100;

/**
 * V1: Minimum evidence — supportingNodes.length >= 2
 * V2: Confidence threshold — confidence >= 0.4
 * V3: Status must be candidate
 * V4: Evidence links must exist (supporting nodes must be in graph)
 * V5: Budget available — activeInsightCount < 100
 */
export function verifyCandidate(
  insight: Insight,
  activeInsights: Insight[] = [],
  existingNodeIds?: Set<string>,
): VerificationResult {
  const reasons: string[] = [];

  // V3: Status must be candidate
  if (insight.status !== "candidate") {
    reasons.push("not_candidate");
  }

  // V1: Minimum evidence
  if (insight.supportingNodes.length < MIN_SUPPORTING_NODES) {
    reasons.push("insufficient_supporting_evidence");
  }

  // V2: Confidence threshold
  if (insight.confidence < CONFIDENCE_THRESHOLD) {
    reasons.push("confidence_below_threshold");
  }

  // V4: Evidence links must exist
  if (existingNodeIds) {
    const missingLinks = insight.supportingNodes.filter((id) => !existingNodeIds.has(id));
    if (missingLinks.length > 0) {
      reasons.push("missing_evidence_links");
    }
  }

  // V5: Budget available
  let budgetViolation = false;
  if (activeInsights.length >= MAX_ACTIVE_INSIGHTS) {
    budgetViolation = true;
    reasons.push("budget_exceeded");
  }

  // Duplicate detection
  let duplicateInsightId: string | undefined;
  const duplicate = findDuplicateInsight(insight, activeInsights);
  if (duplicate) {
    duplicateInsightId = duplicate.id;
  }

  const approved = reasons.length === 0 && !duplicate;

  return {
    approved,
    reasons,
    confidence: insight.confidence,
    stability: insight.stability,
    duplicateInsightId,
    budgetViolation,
  };
}

/**
 * Find duplicate insight in active insights.
 * Duplicate rule: same type, same entity (claim), same claim.
 * Exact match only — no embeddings, no AI similarity.
 */
export function findDuplicateInsight(
  candidate: Insight,
  activeInsights: Insight[],
): Insight | undefined {
  return activeInsights.find(
    (existing) =>
      existing.type === candidate.type &&
      existing.claim === candidate.claim &&
      existing.status !== "archived" &&
      existing.status !== "invalidated",
  );
}

/**
 * Promote candidate to active.
 * candidate → verified → active (verified is transient, final = active)
 */
export function promoteCandidate(insight: Insight): Insight {
  return {
    ...insight,
    status: "active",
    lastValidatedAt: new Date(),
  };
}

/**
 * Reinforce existing insight with candidate's evidence.
 * Union supporting nodes, update lastValidatedAt, status → reinforced.
 * Recalculate confidence and stability.
 */
export function reinforceInsight(existing: Insight, candidate: Insight): Insight {
  const unionNodes = [...new Set([...existing.supportingNodes, ...candidate.supportingNodes])];

  // Recalculate confidence and stability using existing engines
  // We need node objects — use importance from existing insight as proxy
  // In practice, the caller would pass real nodes. Here we use the insight's importance.
  const supportingNodes = unionNodes.map((id) => ({
    id,
    importance: existing.importance,
  }));

  const confidenceResult = calculateConfidence(supportingNodes, []);
  const stabilityResult = calculateStability(
    { ...existing, supportingNodes: unionNodes },
    supportingNodes.map((n) => ({
      id: n.id,
      kind: "fact" as const,
      importance: n.importance,
      createdAt: existing.createdAt,
      lastValidatedAt: new Date(),
    })),
    [],
  );

  return {
    ...existing,
    supportingNodes: unionNodes,
    status: "reinforced",
    lastValidatedAt: new Date(),
    confidence: confidenceResult.confidence,
    stability: stabilityResult.stability,
  };
}

/**
 * Archive an insight with a reason.
 */
export function archiveInsight(insight: Insight, reason: string): Insight {
  return {
    ...insight,
    status: "archived",
    lastValidatedAt: new Date(),
  };
}

/**
 * Process a batch of candidates against active insights.
 */
export function processReviewQueue(
  candidates: Insight[],
  activeInsights: Insight[],
): ProcessResult {
  const promoted: Insight[] = [];
  const reinforced: Insight[] = [];
  const rejected: { insightId: string; reasons: string[] }[] = [];

  // Track active count as we process
  let currentActiveCount = activeInsights.length;
  const currentActive = [...activeInsights];

  for (const candidate of candidates) {
    const verification = verifyCandidate(candidate, currentActive);

    if (verification.duplicateInsightId) {
      // Reinforce existing
      const existing = currentActive.find((a) => a.id === verification.duplicateInsightId);
      if (existing) {
        const reinforcedInsight = reinforceInsight(existing, candidate);
        reinforced.push(reinforcedInsight);
        // Update in currentActive
        const idx = currentActive.findIndex((a) => a.id === existing.id);
        if (idx >= 0) currentActive[idx] = reinforcedInsight;
      }
      continue;
    }

    if (!verification.approved) {
      rejected.push({
        insightId: candidate.id,
        reasons: verification.reasons,
      });
      continue;
    }

    // Promote
    const promotedInsight = promoteCandidate(candidate);
    promoted.push(promotedInsight);
    currentActive.push(promotedInsight);
    currentActiveCount++;
  }

  return { promoted, reinforced, rejected };
}
