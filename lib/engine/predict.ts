// lib/engine/predict.ts
// Phase 11: Prediction Engine
// Transforms insights into predictions and learns from outcomes.

import type { Insight, Prediction, Warning, RiskLevel } from "./reflective-memory-types";
import { createInsight } from "./reflective-memory-types";

export interface TaskContext {
  entities: string[];
  category?: string;
  title?: string;
  description?: string;
}

export interface PredictionEvaluation {
  predictionId: string;
  correct: boolean;
  evaluatedAt: Date;
  actualResult: string | null;
}

export interface PredictionResult {
  prediction: Prediction;
  warning: Warning | null;
}

const PREDICTIVE_VALUE_THRESHOLD = 0.5;
const MIN_PREDICTION_COUNT = 3;
const WARNING_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Extract entities from context.
 */
function contextEntities(ctx: TaskContext): string[] {
  const entities = [...ctx.entities];
  if (ctx.title) entities.push(...ctx.title.toLowerCase().split(/\s+/));
  if (ctx.description) entities.push(...ctx.description.toLowerCase().split(/\s+/));
  return [...new Set(entities.map((e) => e.toLowerCase().replace(/[^a-z]/g, "")).filter((e) => e.length > 2))];
}

/**
 * Calculate entity match score between context and insight claim.
 */
function entityMatchScore(contextEntities: string[], insightClaim: string): number {
  if (contextEntities.length === 0) return 0;
  const claimLower = insightClaim.toLowerCase();
  const matched = contextEntities.filter((e) => claimLower.includes(e));
  return matched.length / contextEntities.length;
}

/**
 * Get matching insights for a task context.
 * Rule P1: Only active/reinforced insights.
 * Rule P2: predictiveValue > 0.5 (or null with <3 predictions).
 */
export function getMatchingInsights(
  context: TaskContext,
  activeInsights: Insight[],
): Insight[] {
  const ctxEntities = contextEntities(context);

  return activeInsights.filter((insight) => {
    // P1: Only active/reinforced
    if (insight.status !== "active" && insight.status !== "reinforced") return false;

    // P2: Predictive value threshold
    if (insight.predictiveValue !== null && insight.predictiveValue <= PREDICTIVE_VALUE_THRESHOLD) return false;

    // P3: No predictive value before enough evidence
    // (predictiveValue is null if predictionCount < 3 — that's fine, we still allow matching)
    // But if predictiveValue is explicitly set and <= 0.5, skip (handled above)

    // Entity match
    const score = entityMatchScore(ctxEntities, insight.claim);
    return score > 0;
  });
}

/**
 * Generate predictions from matching insights.
 */
export function generatePredictions(
  context: TaskContext,
  activeInsights: Insight[],
): Prediction[] {
  const matching = getMatchingInsights(context, activeInsights);
  const ctxEntities = contextEntities(context);

  return matching.map((insight) => ({
    id: `pred-${insight.id}-${Date.now()}`,
    insightId: insight.id,
    claim: insight.claim,
    context: ctxEntities.join(", "),
    confidence: insight.confidence,
    createdAt: new Date(),
    evaluatedAt: null,
    outcome: null,
    actualResult: null,
  }));
}

/**
 * Evaluate a prediction against actual outcome.
 */
export function evaluatePrediction(
  prediction: Prediction,
  actualOutcome: "correct" | "incorrect" | "untested",
  actualResult: string | null = null,
): Prediction {
  return {
    ...prediction,
    evaluatedAt: new Date(),
    outcome: actualOutcome,
    actualResult,
  };
}

/**
 * Update predictive value of an insight based on evaluations.
 * Formula: predictiveValue = correctPredictions / predictionCount
 * P3: If predictionCount < 3, predictiveValue = null
 */
export function updatePredictiveValue(
  insight: Insight,
  evaluations: { correct: boolean }[],
): Insight {
  const predictionCount = evaluations.length;
  const correctPredictions = evaluations.filter((e) => e.correct).length;

  let predictiveValue: number | null = null;
  if (predictionCount >= MIN_PREDICTION_COUNT) {
    predictiveValue = Number((correctPredictions / predictionCount).toFixed(3));
  }

  return {
    ...insight,
    predictionCount,
    correctPredictions,
    predictiveValue,
    lastValidatedAt: new Date(),
  };
}

/**
 * Determine risk level from insight and prediction.
 */
function determineRiskLevel(insight: Insight, prediction: Prediction): RiskLevel {
  if (prediction.confidence >= 0.8 && insight.confidence >= 0.7) return "high";
  if (prediction.confidence >= 0.6) return "medium";
  return "low";
}

/**
 * Create a warning from a prediction (only if confidence >= 0.6 and risk >= medium).
 */
export function createWarning(
  prediction: Prediction,
  insight: Insight,
  riskLevel?: RiskLevel,
): Warning | null {
  if (prediction.confidence < WARNING_CONFIDENCE_THRESHOLD) return null;

  const level = riskLevel ?? determineRiskLevel(insight, prediction);
  if (level === "low") return null;

  return {
    id: `warn-${prediction.id}`,
    predictionId: prediction.id,
    insightId: insight.id,
    message: `⚠ Historical Pattern Detected\n\nInsight: ${insight.claim}\n\nRisk Level: ${level}\n\nSupporting Evidence: ${insight.supportingNodes.join(", ")}\n\nPredictive Value: ${insight.predictiveValue ?? "N/A"}\n\nRecommendation: Review previous outcomes before proceeding.`,
    riskLevel: level,
    supportingEvidence: insight.supportingNodes,
    createdAt: new Date(),
    dismissedAt: null,
    dismissedBy: null,
  };
}

/**
 * Generate predictions with optional warnings.
 */
export function generatePredictionsWithWarnings(
  context: TaskContext,
  activeInsights: Insight[],
): { predictions: Prediction[]; warnings: Warning[] } {
  const predictions = generatePredictions(context, activeInsights);
  const warnings: Warning[] = [];

  for (const pred of predictions) {
    const insight = activeInsights.find((i) => i.id === pred.insightId);
    if (insight) {
      const warning = createWarning(pred, insight);
      if (warning) warnings.push(warning);
    }
  }

  return { predictions, warnings };
}
