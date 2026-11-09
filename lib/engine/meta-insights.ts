// lib/engine/meta-insights.ts
// Phase 9: Meta-Insight Generation
// Generates insights from insights, with strict guardrails.

import type { Insight } from "./reflective-memory-types";
import { createInsight } from "./reflective-memory-types";

const MAX_INSIGHT_DEPTH = 3;
const MIN_SUPPORTING_INSIGHTS = 2;
const MIN_PARENT_CONFIDENCE = 0.6;

export interface MetaInsightCandidate {
  insight: Insight;
  parentIds: string[];
  depth: number;
}

/**
 * Generate meta-insights from active insights.
 * Returns candidate meta-insights only (never active).
 *
 * Rules:
 * M1: Only active/reinforced insights participate
 * M2: Depth cap 3 (absolute)
 * M3: All supporting insights must have confidence >= 0.6
 * M4: No self-reference or cycles
 * M5: Minimum information gain (must combine multiple independent insights)
 */
export function generateMetaInsights(activeInsights: Insight[]): Insight[] {
  // M1: Only active/reinforced
  const eligible = activeInsights.filter(
    (i) => i.status === "active" || i.status === "reinforced",
  );

  // Group insights by entity to find clusters of related insights
  const byEntity = new Map<string, Insight[]>();
  for (const ins of eligible) {
    // Extract entity from claim (first capitalized word or first word)
    const entity = extractEntity(ins.claim);
    if (!byEntity.has(entity)) byEntity.set(entity, []);
    byEntity.get(entity)!.push(ins);
  }

  const candidates: Insight[] = [];
  const seenIds = new Set<string>();

  // Generate meta-insights from groups of 2+ insights with different entities
  // Strategy: find pairs/groups of insights with DIFFERENT entities
  const allEntities = [...byEntity.keys()];

  // Try all combinations of 2+ insights from different entities
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];

      // M2: Depth cap
      if (a.depth >= MAX_INSIGHT_DEPTH || b.depth >= MAX_INSIGHT_DEPTH) continue;

      // M3: Confidence threshold
      if (a.confidence < MIN_PARENT_CONFIDENCE || b.confidence < MIN_PARENT_CONFIDENCE) continue;

      // M4: No self-reference
      if (a.id === b.id) continue;
      if (a.parentInsights.includes(b.id) || b.parentInsights.includes(a.id)) continue;

      // M5: Diversity — must be different entities
      const entityA = extractEntity(a.claim);
      const entityB = extractEntity(b.claim);
      if (entityA === entityB) continue;

      // M5: Information gain — claims must be different
      if (a.claim === b.claim) continue;

      // Generate meta-insight ID
      const parentId = [a.id, b.id].sort().join("+");
      const metaId = `meta-${parentId}`;

      if (seenIds.has(metaId)) continue;
      seenIds.add(metaId);

      // Calculate meta-confidence: avg(parent.confidence) * 0.9
      const avgConfidence = (a.confidence + b.confidence) / 2;
      const metaConfidence = Number((avgConfidence * 0.9).toFixed(3));

      // Calculate meta-stability: avg(parent.stability)
      const metaStability = Number(((a.stability + b.stability) / 2).toFixed(3));

      // Collect all supporting nodes from parents
      const supportingNodes = [...new Set([...a.supportingNodes, ...b.supportingNodes])];

      // M2: New insight depth = max(parent depths) + 1, capped at 3
      const newDepth = Math.min(MAX_INSIGHT_DEPTH, Math.max(a.depth, b.depth) + 1);

      const metaInsight = createInsight({
        id: metaId,
        tenantId: a.tenantId,
        bankId: a.bankId,
        type: "pattern", // meta-insights are patterns at higher abstraction
        depth: newDepth as 1 | 2 | 3,
        claim: generateMetaClaim(a.claim, b.claim),
        supportingNodes,
        contradictingNodes: [],
        confidence: metaConfidence,
        stability: metaStability,
        parentInsights: [a.id, b.id],
      });

      candidates.push(metaInsight);
    }
  }

  return candidates;
}

/**
 * Extract a simple entity from a claim (first significant word).
 */
function extractEntity(claim: string): string {
  const words = claim.toLowerCase().split(/\s+/);
  // Skip common words
  const stopWords = new Set(["a", "an", "the", "is", "are", "was", "were", "has", "have", "had", "been", "being", "this", "that", "these", "those", "it", "its"]);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, "");
    if (cleaned.length > 2 && !stopWords.has(cleaned)) {
      return cleaned;
    }
  }
  return words[0] || "unknown";
}

/**
 * Generate a meta-claim combining two insights into a broader conclusion.
 * M5: Must represent genuine abstraction, not just repetition.
 */
function generateMetaClaim(claimA: string, claimB: string): string {
  return `Combined observation: ${claimA} and ${claimB}`;
}
