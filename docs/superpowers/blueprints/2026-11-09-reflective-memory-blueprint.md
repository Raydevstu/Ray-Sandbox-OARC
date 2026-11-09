# Reflective Memory
## Technical Design Blueprint v1

**Project:** Ray Sandbox OARC — Hindsight Memory Slice
**Status:** DESIGN ONLY — no implementation yet
**Date:** 2026-11-09
**Author:** Hermes Agent (with architectural review by user)

---

## 1. Vision

Reflective Memory transforms stored facts into evidence-backed insights that evolve over time. The system continuously synthesises observations, tracks confidence and stability, generates higher-order conclusions, and eventually produces predictive warnings based on historical patterns. It is not a database that stores facts — it is a knowledge synthesis engine that understands your work.

---

## 2. Design Principles

These principles are non-negotiable. Every implementation decision must trace back to one of these.

### Schema Rule S1: Never Physically Delete Insights

Insights are immutable historical artifacts. Allowed states: candidate, verified, active, reinforced, archived, invalidated. Deletion is forbidden. Archive them. Invalidate them. Supersede them. But never delete them. This preserves audit history, prediction accuracy tracking, and truth-maintenance chains.

### Schema Rule G1: Every EvidenceLink Must Reference an Existing MemoryNode

At creation time, both sourceNodeId and targetNodeId must reference existing MemoryNodes (Fact or Insight) in the same tenant/bank. Enforced via application-level validation (and optionally FK constraints). An evidence link to a non-existent node is invalid and must be rejected.

| ID | Principle | Meaning |
|----|-----------|---------|
| P1 | Every insight must cite evidence | No insight exists without at least 2 supporting MemoryNode references. An insight without sources is an opinion, not a memory. |
| P2 | Insights are hypotheses, not truths | Insights are probabilistic conclusions that can be invalidated. They are never treated as ground truth. |
| P3 | Confidence and stability are independent | Confidence measures "is this true right now?" Stability measures "will this still be true next month?" They are computed separately and never conflated. |
| P4 | Memory must compress over time | The system must never grow unbounded. Consolidation, dedup, and budget enforcement are mandatory, not optional. |
| P5 | Predictions must be explainable | Every prediction surfaces its supporting evidence. No black-box warnings. |
| P6 | No insight exists without provenance | Every insight traces to source facts through an evidence graph. Provenance is immutable. |
| P7 | Reflection cost must scale sub-linearly | Reflection must not re-process all facts on every sync. Incremental clustering ensures cost grows slower than data. |
| P8 | Truth maintenance is continuous | Insights are re-evaluated against new evidence. Obsolete insights are replaced, not just archived. |

---

## 3. Core Domain Model

### MemoryNode (base interface)

```typescript
interface MemoryNode {
  id: string
  kind: "fact" | "insight"
  importance: number          // 0-100
  createdAt: Date
  lastValidatedAt: Date
}
```

### Fact (extends MemoryNode)

```typescript
interface Fact extends MemoryNode {
  kind: "fact"
  tenantId: string
  bankId: string
  entity: string
  category: FactCategory     // decision | implementation | progress | failure | success | goal | workflow | note
  claim: string
  confidence: number        // 0.0-1.0
  occurrences: number
  provenance: Provenance
}

type FactCategory = "decision" | "implementation" | "progress" | "failure" | "success" | "goal" | "workflow" | "note"

interface Provenance {
  source: "hermes-push" | "auto-import" | "retain" | "reflection"
  sessionId?: string
  turnId?: string
  sourceFacts?: string[]     // for reflection-generated facts
}
```

### Insight (extends MemoryNode)

```typescript
interface Insight extends MemoryNode {
  kind: "insight"
  tenantId: string
  bankId: string
  type: InsightType
  depth: 1 | 2 | 3
  claim: string
  supportingNodes: string[]   // MemoryNode IDs (facts or insights)
  contradictingNodes: string[]
  confidence: number         // 0.0-1.0
  stability: number          // 0.0-1.0
  predictiveValue: number | null  // 0.0-1.0, null if no predictions tested
  parentInsights: string[]   // for depth 2+ insights
  status: InsightStatus
  predictionCount: number
  correctPredictions: number
}

type InsightType = "pattern" | "causal" | "tendency" | "correlation" | "warning"

type InsightStatus = "candidate" | "active" | "reinforced" | "archived" | "invalidated"
```

### EvidenceLink

```typescript
interface EvidenceLink {
  id: string
  sourceNodeId: string       // the insight or fact that cites
  targetNodeId: string       // the fact or insight being cited
  relation: EvidenceRelation
  weight: number            // 0.0-1.0, how strongly this evidence supports/contradicts
  createdAt: Date
}

type EvidenceRelation = "supports" | "contradicts" | "supersedes" | "derivedFrom" | "predicts"
```

### Prediction

```typescript
interface Prediction {
  id: string
  insightId: string         // the insight that generated this prediction
  claim: string             // "Infrastructure changes with data movement will likely fail"
  context: string           // what task/context triggered this prediction
  confidence: number        // inherited from insight at prediction time
  createdAt: Date
  evaluatedAt: Date | null
  outcome: "correct" | "incorrect" | "untested" | null
  actualResult: string | null
}
```

### Warning

```typescript
interface Warning {
  id: string
  predictionId: string
  insightId: string
  message: string           // human-readable warning
  riskLevel: "low" | "medium" | "high"
  supportingEvidence: string[]  // MemoryNode IDs
  createdAt: Date
  dismissedAt: Date | null
  dismissedBy: string | null
}
```

### ReflectionCluster

```typescript
interface ReflectionCluster {
  id: string
  tenantId: string
  bankId: string
  entity: string
  nodeIds: string[]         // MemoryNode IDs in this cluster
  insightIds: string[]      // insights generated from this cluster
  lastReflectedAt: Date
  nextReflectAt: Date
}
```

### Domain Model Diagram

```
MemoryNode
├── Fact
│   ├── entity, category, claim
│   ├── confidence, occurrences
│   └── provenance
└── Insight
    ├── type, depth, claim
    ├── supportingNodes[], contradictingNodes[]
    ├── confidence, stability, predictiveValue
    ├── parentInsights[]
    └── status

EvidenceLink
├── supports (Fact → Insight)
├── contradicts (Fact → Insight)
├── supersedes (Fact → Fact)
├── derivedFrom (Insight → Insight)
└── predicts (Insight → Prediction)

Prediction → Warning (when risk is high and pattern matches current task)
```

---

## 4. Insight Taxonomy

| Type | Description | How Generated | How Recalled | How Ranked | How Decays |
|------|-------------|---------------|-------------|------------|------------|
| `pattern` | Recurring observation across multiple facts | 3+ facts share entity + same category | On matching entity queries | By confidence + recency | Decays if no new supporting facts in 30 days |
| `causal` | A causes B relationship | Decision fact followed by failure/success within 48h | On "why" queries | By confidence + predictive value | Decays if contradicting evidence appears |
| `tendency` | Behavioral pattern over time | Same action repeated across 3+ sessions | On entity queries | By stability + confidence | Decays slowly (stability-weighted) |
| `correlation` | Two things co-occur | 2+ entities appear together in 3+ facts | On multi-entity queries | By confidence | Decays if co-occurrence stops |
| `warning` | Predictive alert about future risk | Insight with predictiveValue > 0.6 matches current task | Proactively on task start | By risk level + predictive value | Expires after task completes or 7 days |

---

## 5. Evidence Graph

The evidence graph is the backbone of the entire system. Every insight is a node in this graph, connected to its supporting and contradicting facts/insights via typed edges.

### Relationships

| Relation | Direction | Meaning |
|----------|-----------|---------|
| `supports` | Fact/Insight → Insight | This node provides evidence for the insight |
| `contradicts` | Fact/Insight → Insight | This node provides evidence against the insight |
| `supersedes` | Fact → Fact | This fact replaces an older fact |
| `derivedFrom` | Insight → Insight | This insight was generated from parent insights |
| `predicts` | Insight → Prediction | This insight generated a prediction |

### Graph Operations

- **Traversal**: From any insight, traverse supporting/contradicting edges to reach source facts. Depth-limited to 3 hops.
- **Subgraph extraction**: Given a query, extract the subgraph of relevant insights + their evidence. This is what gets returned in recall.
- **Orphan detection**: Insights whose all supporting facts have been superseded are flagged for re-evaluation.
- **Cycle prevention**: `derivedFrom` edges cannot form cycles. Max depth is 3.

---

## 6. Reflection Engine

### Pipeline

```
Sync completes
  ↓
1. Fact ingestion (new facts from sync)
  ↓
2. Clustering (group facts by entity + time window)
  ↓
3. Candidate generation (pattern detection per cluster)
  ↓
4. Evidence verification (min 2 supporting facts, confidence ≥ 0.4)
  ↓
5. Promotion (candidate → active if verified)
  ↓
6. Index update (add to recall index)
  ↓
7. Meta-insight generation (if depth < 3 and enough supporting insights)
```

### Trigger Points

| Trigger | Scope | Frequency |
|---------|-------|-----------|
| After hermes-push sync | Incremental (affected clusters only) | Per sync (every 5 min) |
| Nightly cron | Full reflection (all clusters) | Once per day |
| Manual `POST /api/v1/memory/reflect` | Full reflection | On demand |

### Clustering Algorithm

```
For each new fact F:
  Find existing clusters where entity matches F.entity
  If cluster exists and lastReflectedAt < 7 days ago:
    Add F to cluster
  Else:
    Create new cluster with F
```

Clusters are never deleted. They grow and are re-reflected when new facts arrive.

### Candidate Generation Rules

| Rule | Condition | Insight Type | Min Facts |
|------|-----------|-------------|-----------|
| Recurring failure | 3+ facts, same entity, category=failure | pattern | 3 |
| Decision → failure | decision fact followed by failure within 48h | causal | 2 |
| Decision → success | decision fact followed by success within 48h | causal | 2 |
| Behavioral tendency | Same action repeated across 3+ sessions | tendency | 3 |
| Co-occurrence | 2+ entities appear together in 3+ facts | correlation | 3 |
| Risk prediction | Insight with 3+ contradicting outcomes | warning | 3 |

### Verification Criteria (candidate → active)

- At least 2 supporting MemoryNodes
- Confidence ≥ 0.4 (using confidence formula)
- No existing active insight with cosine similarity > 0.8 to this claim (dedup)
- Total active insights for bank < 100 (budget)

---

## 7. Confidence Engine

### Formula

```
confidence = evidence_strength × sample_size_factor

where:
  supporting_weight = sum of importance scores of supporting nodes
  contradicting_weight = sum of importance scores of contradicting nodes
  total_weight = supporting_weight + contradicting_weight

  evidence_strength = (supporting_weight - contradicting_weight) / total_weight
  sample_size_factor = min(1.0, total_evidence_count / 10)

  floor: 0.3
  ceiling: 0.95

  if total_weight == 0: confidence = 0.3 (tentative, no evidence yet)
```

### Example Calculations

**Scenario A: 3 supporting facts, no contradictions**
- supporting_weight = 50 + 60 + 40 = 150
- contradicting_weight = 0
- evidence_strength = 150 / 150 = 1.0
- sample_size_factor = min(1.0, 3/10) = 0.3
- confidence = 1.0 × 0.3 = 0.3 → tentative

**Scenario B: 12 supporting facts, 2 contradicting**
- supporting_weight = 600
- contradicting_weight = 80
- evidence_strength = (600-80) / 680 = 0.765
- sample_size_factor = min(1.0, 14/10) = 1.0
- confidence = 0.765 × 1.0 = 0.765 → moderate

**Scenario C: 30 supporting facts, 1 contradicting**
- supporting_weight = 1500
- contradicting_weight = 50
- evidence_strength = (1500-50) / 1550 = 0.935
- sample_size_factor = min(1.0, 31/10) = 1.0
- confidence = 0.935 × 1.0 = 0.935 → strong

---

## 8. Stability Engine

### Definition

Stability measures how likely an insight is to remain true over time. It is independent of confidence.

### Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Time span of evidence | 0.4 | Wider time range = more stable. 1 day = 0.1, 30 days = 0.5, 90+ days = 1.0 |
| Source stability | 0.3 | Average stability of supporting facts. Insights built on stable facts are more stable. |
| Contradiction recency | 0.2 | Recent contradictions reduce stability. No recent contradictions = 1.0 |
| Entity persistence | 0.1 | Entity appears in facts across multiple sessions = more stable |

### Stability Tiers

| Tier | Range | Behavior |
|------|-------|----------|
| Short-term | 0.0-0.3 | Decays in 7 days if not reinforced. Used for current sprint goals, temporary focus. |
| Medium-term | 0.3-0.7 | Decays in 30 days if not reinforced. Used for architecture preferences, tool choices. |
| Long-term | 0.7-1.0 | Decays in 90+ days. Used for career objectives, core values, fundamental preferences. |

### Decay Formula

```
stability_new = stability_old × decay_factor

where:
  decay_factor = 1.0 - (days_since_last_validation / decay_threshold_days)
  decay_threshold_days = 7 (short), 30 (medium), 90 (long) based on tier

  if stability_new < 0.1: insight → archived
```

---

## 9. Contradiction Engine

### Detection

A contradiction occurs when:
- Two facts share the same entity
- Their claims are semantically opposed (detected via entity + category + claim similarity > 0.6 but claim text similarity < 0.3)
- Or: an insight's supporting fact is superseded by a new fact with opposing claim

### Resolution Pipeline

```
Contradiction detected
  ↓
1. Score contradiction strength (0.0-1.0)
   = claim_similarity × (1 - outcome_agreement)
  ↓
2. Reduce insight confidence
   confidence_new = confidence_old × (1 - contradiction_strength × 0.5)
  ↓
3. If confidence drops below 0.4:
   → Move insight to "archived" status
   → Create new candidate insight from contradicting evidence
  ↓
4. If contradiction_strength > 0.8:
   → Create tension record (for user review)
   → Surface in recall as "conflicting evidence exists"
```

### Truth Maintenance

When an insight is contradicted:
- The system does NOT simply lower confidence
- It actively recognizes the insight may be obsolete
- It generates a new candidate insight from the contradicting evidence
- The old insight is archived with reason "superseded by contradicting evidence"
- The new insight links to the old via `supersedes` edge

This is the difference between "maintaining confidence" and "maintaining an evolving model of reality."

---

## 10. Insight Review Queue

### States

```
candidate → verified → active → reinforced → archived → invalidated
```

### State Transitions

| From | To | Condition |
|------|----|-----------|
| (new) | candidate | Pattern detected, insight generated |
| candidate | verified | Evidence verification passes (≥2 supporting, confidence ≥ 0.4, no dedup conflict, budget available) |
| candidate | (discarded) | Verification fails |
| verified | active | Promoted to active index |
| active | reinforced | New supporting evidence arrives, confidence increases |
| active | archived | Confidence drops below 0.4, or contradicted, or budget exceeded |
| archived | invalidated | Source facts superseded, insight no longer relevant |

### Entry/Exit Criteria

- **candidate**: Generated by pattern detection. Has not been verified.
- **verified**: Passed evidence verification. Ready for promotion.
- **active**: In the recall index. Can be returned in queries.
- **reinforced**: Received new supporting evidence. Confidence boosted.
- **archived**: Removed from active index. Retained for audit/history.
- **invalidated**: Source facts no longer exist. Insight is dead.

---

## 11. Consolidation Engine

### Purpose

Prevent insight explosion. Without consolidation, 10,000 facts → 2,000 insights → 800 meta-insights → system drowns.

### Operations

| Operation | Trigger | Description |
|-----------|---------|-------------|
| Merge | Weekly cron | Cluster related active insights (cosine similarity > 0.7). Merge into single higher-level insight. Archive originals. |
| Dedup | On insight creation | Before creating new insight, check existing active insights. If similarity > 0.8, reinforce instead of create. |
| Summarize | On budget exceeded | When active insights > 100, summarize lowest-confidence insights into a single "summary insight." |
| Archive | On budget exceeded | Archive lowest-confidence, lowest-predictive-value insights. |
| Budget enforcement | After every reflection | Max 100 active insights per bank. Max 50 meta-insights (depth 2+). |

### Consolidation Pipeline

```
Weekly cron triggers
  ↓
1. Cluster active insights by entity + type
  ↓
2. For each cluster with 3+ insights:
   → Generate merged insight (higher depth)
   → Archive source insights
   → Link merged insight via derivedFrom
  ↓
3. If active count > 100:
   → Archive lowest (confidence × predictive_value) insights
  ↓
4. If meta-insight count > 50:
   → Consolidate meta-insights into meta-meta-insights (depth 3, max)
```

---

## 12. Meta-Insight Generation

### Rules

- Max depth: 3 (facts → insight → meta-insight → meta-meta-insight, stop)
- Meta-insights require at least 2 supporting insights (not raw facts)
- Meta-insights require minimum confidence 0.6 on all supporting insights
- Meta-insights require minimum diversity: supporting insights must span at least 2 different entities or 2 different sessions
- Meta-insight confidence = average of supporting insight confidences × 0.9 (inherent uncertainty penalty for higher abstraction)

### Generation

Meta-insights are generated during the nightly full reflection. They are not generated during incremental sync reflection (too noisy, not enough signal).

---

## 13. Prediction Engine

### Pipeline

```
Task/session starts
  ↓
1. Load active insights for bank
  ↓
2. For each insight with predictiveValue != null and predictiveValue > 0.5:
   Check if insight pattern matches current task context
  ↓
3. If match:
   → Create Prediction record
   → Surface Warning (if riskLevel >= medium)
  ↓
4. User acknowledges/dismisses/overrides
  ↓
5. After task completes:
   → Evaluate prediction (correct/incorrect)
   → Update insight predictiveValue
```

### Prediction Evaluation

```
predictiveValue = correctPredictions / predictionCount

where:
  correctPredictions = count of predictions with outcome = "correct"
  predictionCount = total predictions evaluated

  if predictionCount < 3: predictiveValue = null (insufficient data)
```

### Warning Surfacing

Warnings are surfaced proactively when a task starts. Format:

```
⚠️ Historical pattern detected

Insight: "Infrastructure changes with data movement have failed 7/9 times"
Risk level: HIGH
Supporting evidence: [fact_124, fact_821, fact_901, insight_001]
Predictive value: 78% (9/12 correct predictions)

Recommendation: Review previous failure patterns before proceeding.
```

---

## 14. Recall System

### Query Processing

When user asks: "What do we know about the queue system?"

```
1. Extract entities from query ("queue system")
2. Find active insights matching entities (type: pattern, causal, tendency)
3. Find active insights matching entities (type: warning) → surface proactively
4. Find supporting facts for matched insights
5. Find contradicting facts for matched insights
6. Rank results: insights first (by confidence × predictive_value), then facts (by importance)
7. Return: insights → supporting facts → contradicting facts → predictions
```

### Return Order

1. **Warnings** (if any match current context) — proactive, always first
2. **Insights** (ranked by confidence × predictive_value, descending)
3. **Supporting facts** (ranked by importance, descending)
4. **Contradicting facts** (ranked by importance, descending)
5. **Predictions** (ranked by confidence, descending)

### Context Pack Integration

Insights are included in the context pack alongside facts. The 1500-token cap is shared. Insights get priority (they're more information-dense than raw facts).

---

## 15. Scalability

### Estimates

| Facts | Active Insights | Reflection Time | Consolidation Frequency |
|-------|----------------|-----------------|------------------------|
| 1,000 | ~50 | <1s | Weekly |
| 10,000 | ~100 (budget) | ~5s | Weekly |
| 100,000 | ~100 (budget) | ~30s | Daily |
| 1,000,000 | ~100 (budget) | ~5min | Daily |

### Key Scaling Decisions

- Active insights are capped at 100 per bank (budget enforcement)
- Reflection is incremental on sync (only affected clusters)
- Full reflection is nightly (not per-sync)
- Consolidation merges insights to keep count bounded
- Archived insights are retained but not in recall index
- Meta-insights capped at 50 (depth 2+)

---

## 16. Testing Strategy

### Unit Tests

- Confidence formula: verify calculations with known inputs
- Stability decay: verify decay over time periods
- Contradiction detection: verify opposing claims are detected
- Dedup: verify similar insights are not duplicated

### Property Tests

- Confidence always in [0.3, 0.95]
- Stability always in [0.0, 1.0]
- Active insight count never exceeds budget
- Insight depth never exceeds 3
- Every active insight has ≥2 supporting nodes

### Integration Tests

- Full pipeline: facts → reflection → insights → recall
- Incremental reflection: new facts trigger only affected clusters
- Consolidation: insights merge correctly, budget enforced
- Prediction: insight → prediction → warning → evaluation → predictive value update

### Simulation Tests

- Feed 1,000 synthetic facts with known patterns
- Verify: true patterns generate insights, false patterns don't
- Verify: contradicting evidence reduces confidence
- Verify: insights that predict well get promoted
- Verify: insight explosion doesn't occur (budget enforced)

---

## 17. Metrics

Track these metrics per bank:

| Metric | Description | Target |
|--------|-------------|--------|
| Insights generated | Total insights created (all statuses) | — |
| Insights archived | Insights moved to archived | < 20% of generated |
| Prediction accuracy | correctPredictions / predictionCount | > 60% |
| Average confidence | Mean confidence of active insights | 0.6-0.8 |
| Average stability | Mean stability of active insights | 0.5-0.7 |
| Recall utilization | % of recalls that include insights | > 80% |
| Compression ratio | (facts + insights) / facts | < 1.5 |
| Reflection time | Time per reflection pass | < 5s for 10k facts |
| Insight budget usage | Active insights / 100 | < 80% |

---

## 18. Truth Maintenance System

Every insight is continuously re-evaluated against new evidence.

### Re-evaluation Triggers

- New facts arrive in the same cluster
- A supporting fact is superseded
- A contradicting fact is added
- 30 days pass since last validation

### Re-evaluation Process

```
Insight re-evaluation triggered
  ↓
1. Re-compute confidence with current evidence
  ↓
2. If confidence changed by > 0.1:
   → Update insight
   → Update lastValidatedAt
  ↓
3. If confidence dropped below 0.4:
   → Archive insight
   → Generate new candidate from contradicting evidence
  ↓
4. If insight is obsolete (all supporting facts superseded):
   → Mark as invalidated
   → Create replacement insight from new evidence
```

### Obsolescence Detection

An insight is obsolete when:
- All supporting facts have been superseded
- A newer insight covers the same claim with higher confidence
- The entity no longer appears in recent facts (30+ days)

When obsolete, the system doesn't just archive — it actively replaces with a newer, more accurate insight. This maintains an evolving model of reality, not just a decaying one.

---

## Implementation Order (12 Phases)

```
Phase 1:  MemoryNode model (Fact + Insight separation)         — DB schema + types
Phase 2:  Evidence graph (supporting/contradicting links)       — evidence_links table
Phase 3:  Insight generation (pattern detection → candidate)    — lib/engine/reflect.ts
Phase 4:  Confidence engine (evidence-based formula)            — lib/engine/confidence.ts
Phase 5:  Stability engine (time-based permanence)              — lib/engine/stability.ts
Phase 6:  Contradiction engine (tension tracking)              — lib/engine/contradiction.ts
Phase 7:  Review queue (candidate → active promotion)          — lib/engine/review-queue.ts
Phase 8:  Recall integration (insights in ranked results)       — recall route + context-pack
Phase 9:  Meta-insights (depth 2+ generation)                  — reflect.ts extension
Phase 10: Consolidation (merge, dedup, budget enforcement)      — lib/engine/consolidate.ts
Phase 11: Prediction engine (pattern → warning on task start)   — lib/engine/predict.ts
Phase 12: Decay lifecycle (confidence/stability decay over time) — cron job + decay.ts
```

Each phase: RED test → GREEN implementation → verification → commit. No skipping phases.

---

## Appendix: File Map (planned)

```
lib/engine/
  reflect.ts          — reflection pipeline, pattern detection, candidate generation
  confidence.ts       — confidence formula
  stability.ts        — stability computation and decay
  contradiction.ts    — contradiction detection and resolution
  review-queue.ts     — candidate → active promotion
  consolidate.ts      — merge, dedup, budget enforcement
  predict.ts          — prediction generation and evaluation

lib/server/
  pg-lifecycle.ts     — extended with insight tables + evidence_links
  pg-client.ts        — extended with insight DDL

app/api/v1/memory/
  reflect/route.ts    — POST trigger reflection
  insights/route.ts   — GET insights, POST acknowledge/dismiss
  predict/route.ts    — GET predictions for current context

tests/
  reflect.test.ts
  confidence.test.ts
  stability.test.ts
  contradiction.test.ts
  review-queue.test.ts
  consolidate.test.ts
  predict.test.ts
```
