// lib/engine/recall-ranking.ts
// Phase 8: Recall Integration
// Ranks active insights for recall using deterministic entity matching.
// Formula: finalScore = confidence * stability * relevance

import type { Insight } from "./reflective-memory-types";

export interface RankedInsight {
  insight: Insight;
  relevanceScore: number;
  confidenceScore: number;
  stabilityScore: number;
  finalScore: number;
}

const MAX_INSIGHTS_RETURNED = 10;

/**
 * Extract entities from a query string.
 * Deterministic: lowercase, split on whitespace/punctuation, dedupe.
 */
export function extractQueryEntities(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[\s,;:.!?()]+/)
    .filter((t) => t.length > 1);
  return [...new Set(tokens)];
}

/**
 * Calculate entity match score between query entities and insight claim.
 * Returns 0.0-1.0 based on how many query entities appear in the insight claim.
 */
export function entityMatchScore(queryEntities: string[], insightClaim: string): number {
  if (queryEntities.length === 0) return 0;
  const claimLower = insightClaim.toLowerCase();
  const matched = queryEntities.filter((e) => claimLower.includes(e));
  return matched.length / queryEntities.length;
}

/**
 * Rank a list of insights for a given query.
 * Only active/reinforced insights participate.
 * Returns sorted by finalScore descending, limited to MAX_INSIGHTS_RETURNED.
 */
export function rankInsights(query: string, insights: Insight[]): RankedInsight[] {
  const queryEntities = extractQueryEntities(query);

  const ranked: RankedInsight[] = [];

  for (const insight of insights) {
    // RI-1: Only active/reinforced participate
    if (insight.status !== "active" && insight.status !== "reinforced") continue;

    const relevance = entityMatchScore(queryEntities, insight.claim);
    // Skip insights with zero relevance
    if (relevance === 0 && queryEntities.length > 0) continue;

    const confidence = insight.confidence;
    const stability = insight.stability;
    const finalScore = confidence * stability * (relevance > 0 ? relevance : 0.1);

    ranked.push({
      insight,
      relevanceScore: Number(relevance.toFixed(3)),
      confidenceScore: Number(confidence.toFixed(3)),
      stabilityScore: Number(stability.toFixed(3)),
      finalScore: Number(finalScore.toFixed(3)),
    });
  }

  // Sort by finalScore descending
  ranked.sort((a, b) => b.finalScore - a.finalScore);

  // RI-4: Max 10 insights
  return ranked.slice(0, MAX_INSIGHTS_RETURNED);
}

/**
 * Build a context pack from ranked insights and their supporting/contradicting facts.
 * RI-2: Insights before facts.
 * RI-5: Context budget aware (1500 token cap).
 */
export interface RecallContextPack {
  insights: RankedInsight[];
  supportingFacts: string[];
  contradictingFacts: string[];
  evidenceGraph: string[];
  tokensUsed: number;
}

export function buildRecallContextPack(
  rankedInsights: RankedInsight[],
  factLookup: (nodeId: string) => string | null,
  tokenBudget: number = 1500,
): RecallContextPack {
  const insights: RankedInsight[] = [];
  const supportingFacts: string[] = [];
  const contradictingFacts: string[] = [];
  const evidenceGraph: string[] = [];
  let tokensUsed = 0;

  // RI-2: Insights first
  for (const ri of rankedInsights) {
    const insightText = `[Insight] ${ri.insight.claim} (confidence: ${ri.insight.confidence}, stability: ${ri.insight.stability})`;
    const insightTokens = Math.ceil(insightText.length / 4);
    if (tokensUsed + insightTokens > tokenBudget) break;
    insights.push(ri);
    tokensUsed += insightTokens;

    // Evidence graph: supporting node IDs
    evidenceGraph.push(...ri.insight.supportingNodes.map((id) => `supports:${id}->${ri.insight.id}`));

    // Supporting facts
    for (const nodeId of ri.insight.supportingNodes) {
      const factText = factLookup(nodeId);
      if (factText) {
        const factTokens = Math.ceil(factText.length / 4);
        if (tokensUsed + factTokens > tokenBudget) break;
        if (!supportingFacts.includes(factText)) {
          supportingFacts.push(factText);
          tokensUsed += factTokens;
        }
      }
    }
  }

  // Contradicting facts last
  for (const ri of insights) {
    for (const nodeId of ri.insight.contradictingNodes) {
      const factText = factLookup(nodeId);
      if (factText) {
        const factTokens = Math.ceil(factText.length / 4);
        if (tokensUsed + factTokens > tokenBudget) break;
        if (!contradictingFacts.includes(factText)) {
          contradictingFacts.push(factText);
          tokensUsed += factTokens;
        }
      }
    }
  }

  return {
    insights,
    supportingFacts,
    contradictingFacts,
    evidenceGraph,
    tokensUsed,
  };
}
