// lib/engine/reflective-consolidate.ts
// Phase 10: Consolidation Engine for Reflective Memory
// Prevents insight explosion through merge, dedup, budget enforcement, summarization.

import type { Insight } from "./reflective-memory-types";
import { createInsight } from "./reflective-memory-types";

export interface DedupResult {
  kept: Insight[];
  archived: Insight[];
  deduplicatedCount: number;
}

export interface BudgetResult {
  active: Insight[];
  archived: Insight[];
  overBudget: boolean;
}

export interface ConsolidationResult {
  merged: Insight[];
  archived: Insight[];
  summarized: Insight[];
  deduplicated: number;
  finalActiveCount: number;
  compressionRatio: number;
}

const MAX_ACTIVE_INSIGHTS = 100;
const MAX_ACTIVE_META_INSIGHTS = 50;
const MERGE_THRESHOLD = 3;

function extractEntity(claim: string): string {
  const words = claim.toLowerCase().split(/\s+/);
  const stopWords = new Set(["a", "an", "the", "is", "are", "was", "were", "has", "have", "had", "been", "being", "this", "that", "these", "those", "it", "its", "and", "or", "but"]);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, "");
    if (cleaned.length > 2 && !stopWords.has(cleaned)) {
      return cleaned;
    }
  }
  return words[0] || "unknown";
}

function strength(insight: Insight): number {
  return insight.confidence * insight.stability;
}

export function mergeInsights(insights: Insight[]): Insight {
  const parentIds = insights.map((i) => i.id);
  const supportingNodes = [...new Set(insights.flatMap((i) => i.supportingNodes))];
  const contradictingNodes = [...new Set(insights.flatMap((i) => i.contradictingNodes))];

  const avgConfidence = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
  const avgStability = insights.reduce((sum, i) => sum + i.stability, 0) / insights.length;
  const maxDepth = Math.max(...insights.map((i) => i.depth));

  const entity = extractEntity(insights[0].claim);
  const claim = `Consolidated ${insights.length} ${entity}-related insights into a unified pattern.`;

  return createInsight({
    id: `merged-${parentIds.sort().join("-")}`,
    tenantId: insights[0].tenantId,
    bankId: insights[0].bankId,
    type: insights[0].type,
    depth: Math.min(3, maxDepth) as 1 | 2 | 3,
    claim,
    supportingNodes,
    contradictingNodes,
    confidence: Number(avgConfidence.toFixed(3)),
    stability: Number(avgStability.toFixed(3)),
    parentInsights: parentIds,
  });
}

export function deduplicateInsights(activeInsights: Insight[]): DedupResult {
  const groups = new Map<string, Insight[]>();

  for (const ins of activeInsights) {
    const entity = extractEntity(ins.claim);
    const key = `${ins.type}::${entity}::${ins.claim}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ins);
  }

  const kept: Insight[] = [];
  const archived: Insight[] = [];
  let deduplicatedCount = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) {
      kept.push(...group);
      continue;
    }
    const sorted = [...group].sort((a, b) => strength(b) - strength(a));
    kept.push(sorted[0]);
    for (let i = 1; i < sorted.length; i++) {
      archived.push({ ...sorted[i], status: "archived" });
      deduplicatedCount++;
    }
  }

  return { kept, archived, deduplicatedCount };
}

export function enforceInsightBudget(activeInsights: Insight[]): BudgetResult {
  const archived: Insight[] = [];
  let active = [...activeInsights];

  const metaInsights = active.filter((i) => i.depth > 1);
  if (metaInsights.length > MAX_ACTIVE_META_INSIGHTS) {
    const toArchive = metaInsights.length - MAX_ACTIVE_META_INSIGHTS;
    const sorted = [...metaInsights].sort((a, b) => {
      const scoreA = a.confidence * (a.predictiveValue ?? 0.5) * a.stability;
      const scoreB = b.confidence * (b.predictiveValue ?? 0.5) * b.stability;
      return scoreA - scoreB;
    });
    const archiveIds = new Set(sorted.slice(0, toArchive).map((i) => i.id));
    for (const ins of active) {
      if (archiveIds.has(ins.id)) {
        archived.push({ ...ins, status: "archived" });
      }
    }
    active = active.filter((i) => !archiveIds.has(i.id));
  }

  if (active.length > MAX_ACTIVE_INSIGHTS) {
    const toArchive = active.length - MAX_ACTIVE_INSIGHTS;
    const sorted = [...active].sort((a, b) => {
      const scoreA = a.confidence * (a.predictiveValue ?? 0.5) * a.stability;
      const scoreB = b.confidence * (b.predictiveValue ?? 0.5) * b.stability;
      return scoreA - scoreB;
    });
    const archiveIds = new Set(sorted.slice(0, toArchive).map((i) => i.id));
    for (const ins of active) {
      if (archiveIds.has(ins.id)) {
        archived.push({ ...ins, status: "archived" });
      }
    }
    active = active.filter((i) => !archiveIds.has(i.id));
  }

  return {
    active,
    archived,
    overBudget: activeInsights.length > MAX_ACTIVE_INSIGHTS || metaInsights.length > MAX_ACTIVE_META_INSIGHTS,
  };
}

export function summarizeInsights(insights: Insight[]): Insight {
  const entity = extractEntity(insights[0].claim);
  const claim = `${insights.length} ${entity}-related insights were consolidated into a higher-level pattern.`;

  const supportingNodes = [...new Set(insights.flatMap((i) => i.supportingNodes))];
  const parentIds = insights.map((i) => i.id);

  const avgConfidence = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
  const avgStability = insights.reduce((sum, i) => sum + i.stability, 0) / insights.length;

  return createInsight({
    id: `summary-${parentIds.sort().join("-")}`,
    tenantId: insights[0].tenantId,
    bankId: insights[0].bankId,
    type: insights[0].type,
    depth: Math.min(3, Math.max(...insights.map((i) => i.depth))) as 1 | 2 | 3,
    claim,
    supportingNodes,
    contradictingNodes: [],
    confidence: Number(avgConfidence.toFixed(3)),
    stability: Number(avgStability.toFixed(3)),
    parentInsights: parentIds,
  });
}

export function runConsolidation(activeInsights: Insight[]): ConsolidationResult {
  const allArchived: Insight[] = [];
  const allMerged: Insight[] = [];
  const allSummarized: Insight[] = [];
  let deduplicatedCount = 0;

  // Step 1: Dedup
  const dedupResult = deduplicateInsights(activeInsights);
  let currentActive = [...dedupResult.kept];
  allArchived.push(...dedupResult.archived);
  deduplicatedCount = dedupResult.deduplicatedCount;

  // Step 2: Merge groups of 3+ related insights (same entity)
  const byEntity = new Map<string, Insight[]>();
  for (const ins of currentActive) {
    const entity = extractEntity(ins.claim);
    if (!byEntity.has(entity)) byEntity.set(entity, []);
    byEntity.get(entity)!.push(ins);
  }

  const toMerge: Insight[][] = [];
  const mergedIds = new Set<string>();

  for (const group of byEntity.values()) {
    if (group.length >= MERGE_THRESHOLD) {
      toMerge.push(group);
      group.forEach((i) => mergedIds.add(i.id));
    }
  }

  for (const group of toMerge) {
    const merged = mergeInsights(group);
    allMerged.push(merged);
    for (const ins of group) {
      allArchived.push({ ...ins, status: "archived" });
    }
    currentActive = currentActive.filter((i) => !mergedIds.has(i.id));
    currentActive.push(merged);
  }

  // Step 3: Budget enforcement
  const budgetResult = enforceInsightBudget(currentActive);
  currentActive = budgetResult.active;
  allArchived.push(...budgetResult.archived);

  // Step 4: If still over budget, summarize
  if (currentActive.length > MAX_ACTIVE_INSIGHTS) {
    const toSummarize = currentActive.slice(MAX_ACTIVE_INSIGHTS);
    const summary = summarizeInsights(toSummarize);
    allSummarized.push(summary);
    for (const ins of toSummarize) {
      allArchived.push({ ...ins, status: "archived" });
    }
    currentActive = currentActive.slice(0, MAX_ACTIVE_INSIGHTS);
    currentActive.push(summary);
  }

  // CE-4: Compression ratio
  const totalFacts = activeInsights.reduce((sum, i) => sum + i.supportingNodes.length, 0);
  const totalInsights = currentActive.length;
  const compressionRatio = totalFacts > 0 ? (totalFacts + totalInsights) / totalFacts : 1;

  return {
    merged: allMerged,
    archived: allArchived,
    summarized: allSummarized,
    deduplicated: deduplicatedCount,
    finalActiveCount: currentActive.length,
    compressionRatio: Number(compressionRatio.toFixed(3)),
  };
}
