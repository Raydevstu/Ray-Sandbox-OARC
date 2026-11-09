// lib/engine/decay.ts
// Phase 12: Decay Lifecycle
// Operational maturity: aging, revalidation, expiration.

import type { Insight, Prediction, Warning } from "./reflective-memory-types";
import { applyStabilityDecay } from "./stability";
import type { StabilityTier } from "./stability";

export interface DecayResult {
  insightsDecayed: number;
  insightsArchived: number;
  insightsRevalidated: number;
  predictionsExpired: number;
  warningsExpired: number;
  coldClustersMarked: number;
}

const STALE_THRESHOLD_DAYS = 30;
const PREDICTION_EXPIRY_DAYS = 90;
const WARNING_EXPIRY_DAYS = 7;
const CLUSTER_INACTIVE_DAYS = 90;
const ARCHIVAL_STABILITY_THRESHOLD = 0.1;

/**
 * Apply decay to an insight's stability.
 * Rule D1: Decay stability, not confidence.
 * Rule D2: Reuse Stability Engine's decay policy.
 * Rule D3: If stability < 0.1 → archived.
 */
export function applyInsightDecay(
  insight: Insight,
  daysSinceValidation: number,
): Insight {
  // Determine tier from current stability
  let tier: StabilityTier;
  if (insight.stability < 0.3) tier = "short";
  else if (insight.stability < 0.7) tier = "medium";
  else tier = "long";

  const newStability = applyStabilityDecay(insight.stability, daysSinceValidation, tier);

  // Rule D3: Archive if below threshold
  if (newStability < ARCHIVAL_STABILITY_THRESHOLD && insight.status === "active") {
    return {
      ...insight,
      stability: newStability,
      status: "archived",
      lastValidatedAt: new Date(),
    };
  }

  return {
    ...insight,
    stability: newStability,
  };
}

/**
 * Apply decay to a prediction.
 * Predictions older than 90 days with no evaluation → expired.
 */
export function applyPredictionDecay(
  prediction: Prediction,
  ageDays: number,
): Prediction {
  if (prediction.evaluatedAt === null && ageDays > PREDICTION_EXPIRY_DAYS) {
    return {
      ...prediction,
      outcome: "untested",
      evaluatedAt: new Date(),
    };
  }
  return prediction;
}

/**
 * Reevaluate stale insights (30+ days since last validation).
 * Rule D4: Reuse Phase 6 truth maintenance.
 */
export function reevaluateStaleInsights(
  insights: Insight[],
): Insight[] {
  const now = Date.now();
  const staleThreshold = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  return insights.map((insight) => {
    const daysSinceValidation = (now - insight.lastValidatedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceValidation >= STALE_THRESHOLD_DAYS && insight.status === "active") {
      // Mark as needing revalidation (status stays active but lastValidatedAt updated)
      return {
        ...insight,
        lastValidatedAt: new Date(), // touched for revalidation
      };
    }
    return insight;
  });
}

/**
 * Archive expired warnings.
 * Expires after 7 days or when task completes.
 */
export function archiveExpiredWarnings(
  warnings: Warning[],
  now: Date = new Date(),
): Warning[] {
  const expiryMs = WARNING_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  return warnings.map((warning) => {
    if (warning.dismissedAt) return warning;
    const age = now.getTime() - warning.createdAt.getTime();
    if (age > expiryMs) {
      return {
        ...warning,
        dismissedAt: now,
        dismissedBy: "system",
      };
    }
    return warning;
  });
}

/**
 * Mark inactive clusters as cold.
 */
export function findInactiveClusters(
  clusters: { id: string; lastReflectedAt: Date | null; nodeIds: string[] }[],
  now: Date = new Date(),
): string[] {
  const inactiveThreshold = CLUSTER_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const coldIds: string[] = [];

  for (const cluster of clusters) {
    if (!cluster.lastReflectedAt) {
      coldIds.push(cluster.id);
      continue;
    }
    const age = now.getTime() - cluster.lastReflectedAt.getTime();
    if (age > inactiveThreshold) {
      coldIds.push(cluster.id);
    }
  }

  return coldIds;
}

/**
 * Run full decay cycle.
 */
export function runDecayCycle(
  insights: Insight[],
  predictions: Prediction[],
  warnings: Warning[],
  now: Date = new Date(),
): DecayResult {
  let insightsDecayed = 0;
  let insightsArchived = 0;
  let insightsRevalidated = 0;
  let predictionsExpired = 0;
  let warningsExpired = 0;

  // Decay insights
  const decayedInsights = insights.map((insight) => {
    if (insight.status !== "active" && insight.status !== "reinforced") return insight;
    const daysSince = (now.getTime() - insight.lastValidatedAt.getTime()) / (24 * 60 * 60 * 1000);
    const decayed = applyInsightDecay(insight, Math.max(1, Math.floor(daysSince)));
    if (decayed.stability !== insight.stability) insightsDecayed++;
    if (decayed.status === "archived") insightsArchived++;
    return decayed;
  });

  // Revalidate stale
  const revalidated = reevaluateStaleInsights(decayedInsights);
  insightsRevalidated = revalidated.filter(
    (i, idx) => i.lastValidatedAt.getTime() !== insights[idx]?.lastValidatedAt.getTime(),
  ).length;

  // Expire predictions
  const expiredPredictions = predictions.map((pred) => {
    const ageDays = (now.getTime() - pred.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    const decayed = applyPredictionDecay(pred, ageDays);
    if (decayed.outcome === "untested" && pred.outcome !== "untested") predictionsExpired++;
    return decayed;
  });

  // Expire warnings
  const expiredWarnings = archiveExpiredWarnings(warnings, now);
  warningsExpired = expiredWarnings.filter(
    (w, idx) => w.dismissedAt && !warnings[idx]?.dismissedAt,
  ).length;

  return {
    insightsDecayed,
    insightsArchived,
    insightsRevalidated,
    predictionsExpired,
    warningsExpired,
    coldClustersMarked: 0,
  };
}
