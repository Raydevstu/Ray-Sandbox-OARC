// lib/engine/confidence.ts
// Phase 4: Confidence Engine
// Pure function, deterministic, no database calls.
// Answers: "How strongly do we believe this insight?"

export interface ConfidenceNode {
  id: string;
  importance: number;
}

export interface ConfidenceResult {
  confidence: number;
  evidenceStrength: number;
  sampleSizeFactor: number;
  supportingWeight: number;
  contradictingWeight: number;
  totalWeight: number;
  totalEvidenceCount: number;
}

const CONFIDENCE_FLOOR = 0.3;
const CONFIDENCE_CEILING = 0.95;
const SATURATION_COUNT = 10;

/**
 * Calculate confidence for an insight given its supporting and contradicting evidence.
 *
 * Formula:
 *   supportingWeight = sum(supporting.importance)
 *   contradictingWeight = sum(contradicting.importance)
 *   totalWeight = supportingWeight + contradictingWeight
 *   evidenceStrength = (supportingWeight - contradictingWeight) / totalWeight
 *   sampleSizeFactor = min(1.0, totalEvidenceCount / 10)
 *   confidence = evidenceStrength * sampleSizeFactor
 *
 * Bounds: 0.3 ≤ confidence ≤ 0.95
 *
 * Negative evidence policy (Option B): When contradicting evidence dominates,
 * confidence is clamped to the floor (0.3), not allowed to go negative.
 * Confidence represents belief in the insight, not direction of evidence.
 *
 * Rule C1 (documented, not yet enforced):
 * An active insight can never have confidence greater than the confidence
 * of its weakest critical supporting node. A conclusion shouldn't substantially
 * exceed the quality of its weakest essential evidence.
 */
export function calculateConfidence(
  supportingNodes: ConfidenceNode[],
  contradictingNodes: ConfidenceNode[] = [],
): ConfidenceResult {
  const supportingWeight = supportingNodes.reduce((sum, n) => sum + n.importance, 0);
  const contradictingWeight = contradictingNodes.reduce((sum, n) => sum + n.importance, 0);
  const totalWeight = supportingWeight + contradictingWeight;
  const totalEvidenceCount = supportingNodes.length + contradictingNodes.length;

  // Edge case: no evidence at all
  if (totalWeight === 0 || totalEvidenceCount === 0) {
    return {
      confidence: CONFIDENCE_FLOOR,
      evidenceStrength: 0,
      sampleSizeFactor: 0,
      supportingWeight: 0,
      contradictingWeight: 0,
      totalWeight: 0,
      totalEvidenceCount: 0,
    };
  }

  // Evidence strength: -1 to +1 range
  const rawStrength = (supportingWeight - contradictingWeight) / totalWeight;

  // Negative evidence policy (Option B): clamp to floor, not negative
  const clampedStrength = Math.max(0, rawStrength);

  // Sample size factor: saturates at 10
  const sampleSizeFactor = Math.min(1.0, totalEvidenceCount / SATURATION_COUNT);

  // Raw confidence
  const rawConfidence = clampedStrength * sampleSizeFactor;

  // Apply floor and ceiling
  const confidence = Math.max(CONFIDENCE_FLOOR, Math.min(CONFIDENCE_CEILING, rawConfidence));

  // Edge case: if rawStrength is 0 (balanced), confidence should be at floor
  // but if there's some supporting evidence, apply the formula
  // Actually: if clampedStrength is 0, rawConfidence is 0, which gets floored to 0.3
  // That's correct — balanced evidence → floor confidence

  return {
    confidence: Number(confidence.toFixed(3)),
    evidenceStrength: Number(clampedStrength.toFixed(3)),
    sampleSizeFactor: Number(sampleSizeFactor.toFixed(3)),
    supportingWeight,
    contradictingWeight,
    totalWeight,
    totalEvidenceCount,
  };
}

/**
 * Convenience: calculate confidence and return just the number.
 */
export function confidenceScore(
  supportingNodes: ConfidenceNode[],
  contradictingNodes: ConfidenceNode[] = [],
): number {
  return calculateConfidence(supportingNodes, contradictingNodes).confidence;
}
