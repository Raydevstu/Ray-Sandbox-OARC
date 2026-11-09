// lib/engine/stability.ts
// Phase 5: Stability Engine
// Pure function, deterministic, no database calls.
// Answers: "How long will this insight remain true?"
// Estimates permanence, not truth.

import type { Insight, MemoryNode } from "./reflective-memory-types";

export type StabilityTier = "short" | "medium" | "long";

export interface StabilityResult {
  stability: number;
  timeSpanScore: number;
  sourceStabilityScore: number;
  contradictionRecencyScore: number;
  entityPersistenceScore: number;
  tier: StabilityTier;
}

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculate stability for an insight given its supporting and contradicting evidence.
 *
 * Formula (from blueprint):
 *   timeSpanScore          weight 0.4
 *   sourceStabilityScore   weight 0.3
 *   contradictionRecencyScore weight 0.2
 *   entityPersistenceScore weight 0.1
 *
 *   stability = sum(score * weight)
 *
 * Tiers:
 *   0.0 - 0.3  → short
 *   0.3 - 0.7  → medium
 *   0.7 - 1.0  → long
 */
export function calculateStability(
  insight: Insight,
  supportingNodes: MemoryNode[],
  contradictingNodes: MemoryNode[] = [],
): StabilityResult {
  // Time span score: how spread out evidence is over time
  const allNodes = [...supportingNodes, ...contradictingNodes];
  let timeSpanScore = 0;
  if (allNodes.length >= 2) {
    const dates = allNodes.map((n) => n.createdAt.getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const span = maxDate - minDate;
    timeSpanScore = Math.min(1.0, span / SIX_MONTHS_MS);
  }

  // Source stability score: average importance of supporting nodes
  let sourceStabilityScore = 0;
  if (supportingNodes.length > 0) {
    const avgImportance = supportingNodes.reduce((sum, n) => sum + n.importance, 0) / supportingNodes.length;
    sourceStabilityScore = avgImportance / 100;
  }

  // Contradiction recency score: recent contradictions lower stability
  let contradictionRecencyScore = 1.0;
  if (contradictingNodes.length > 0) {
    const now = Date.now();
    const recentContradictions = contradictingNodes.filter(
      (n) => now - n.lastValidatedAt.getTime() < SEVEN_DAYS_MS,
    );
    // Each recent contradiction reduces the score
    const penalty = recentContradictions.length / contradictingNodes.length;
    contradictionRecencyScore = Math.max(0, 1.0 - penalty * 0.5);
  }

  // Entity persistence score: how many supporting facts back the insight
  const entityPersistenceScore = Math.min(1.0, supportingNodes.length / 5);

  // Weighted sum
  const stability =
    timeSpanScore * 0.4 +
    sourceStabilityScore * 0.3 +
    contradictionRecencyScore * 0.2 +
    entityPersistenceScore * 0.1;

  const clampedStability = Math.max(0, Math.min(1.0, stability));

  // Tier assignment
  let tier: StabilityTier;
  if (clampedStability < 0.3) tier = "short";
  else if (clampedStability < 0.7) tier = "medium";
  else tier = "long";

  return {
    stability: Number(clampedStability.toFixed(3)),
    timeSpanScore: Number(timeSpanScore.toFixed(3)),
    sourceStabilityScore: Number(sourceStabilityScore.toFixed(3)),
    contradictionRecencyScore: Number(contradictionRecencyScore.toFixed(3)),
    entityPersistenceScore: Number(entityPersistenceScore.toFixed(3)),
    tier,
  };
}

/**
 * Apply stability decay over time.
 * Stability decays based on tier and days since last validation.
 *
 * short tier:  decays 5% per day
 * medium tier: decays 1% per day
 * long tier:   decays 0.1% per day
 */
export function applyStabilityDecay(
  stability: number,
  daysSinceValidation: number,
  tier: StabilityTier,
): number {
  const rates: Record<StabilityTier, number> = {
    short: 0.05,
    medium: 0.01,
    long: 0.001,
  };
  const rate = rates[tier];
  const decayed = stability * Math.pow(1 - rate, daysSinceValidation);
  return Number(Math.max(0, Math.min(1.0, decayed)).toFixed(3));
}
