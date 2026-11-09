/* ============================================================
   Reflective Memory — Phase 1: Core Domain Types
   MemoryNode base + Fact + Insight + EvidenceLink + enums
   ============================================================ */

// ── Enums ──────────────────────────────────────────────────

export type InsightType = "pattern" | "causal" | "tendency" | "correlation" | "warning";

export type InsightStatus = "candidate" | "verified" | "active" | "reinforced" | "archived" | "invalidated";

export type EvidenceRelation = "supports" | "contradicts" | "supersedes" | "derivedFrom" | "predicts";

export type FactCategory = "decision" | "implementation" | "progress" | "failure" | "success" | "goal" | "workflow" | "note";

// ── Base ───────────────────────────────────────────────────

export interface MemoryNode {
  id: string;
  kind: "fact" | "insight";
  importance: number;        // 0-100
  createdAt: Date;
  lastValidatedAt: Date;
}

// ── Fact ───────────────────────────────────────────────────

export interface Provenance {
  source: "hermes-push" | "auto-import" | "retain" | "reflection";
  sessionId?: string;
  turnId?: string;
  sourceFacts?: string[];
}

export interface Fact extends MemoryNode {
  kind: "fact";
  tenantId: string;
  bankId: string;
  entity: string;
  category: FactCategory;
  claim: string;
  confidence: number;        // 0.0-1.0
  occurrences: number;
  provenance: Provenance;
}

// ── Insight ────────────────────────────────────────────────

export interface Insight extends MemoryNode {
  kind: "insight";
  tenantId: string;
  bankId: string;
  type: InsightType;
  depth: 1 | 2 | 3;
  claim: string;
  supportingNodes: string[];   // MemoryNode IDs
  contradictingNodes: string[];
  confidence: number;           // 0.0-1.0
  stability: number;            // 0.0-1.0
  predictiveValue: number | null; // 0.0-1.0, null if untested
  parentInsights: string[];
  status: InsightStatus;
  predictionCount: number;
  correctPredictions: number;
}

// ── Evidence Link ──────────────────────────────────────────

export interface EvidenceLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: EvidenceRelation;
  weight: number;               // 0.0-1.0
  createdAt: Date;
}

// ── Prediction ─────────────────────────────────────────────

export interface Prediction {
  id: string;
  insightId: string;
  claim: string;
  context: string;
  confidence: number;
  createdAt: Date;
  evaluatedAt: Date | null;
  outcome: "correct" | "incorrect" | "untested" | null;
  actualResult: string | null;
}

// ── Warning ────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export interface Warning {
  id: string;
  predictionId: string;
  insightId: string;
  message: string;
  riskLevel: RiskLevel;
  supportingEvidence: string[];
  createdAt: Date;
  dismissedAt: Date | null;
  dismissedBy: string | null;
}

// ── Factory helpers ────────────────────────────────────────

export function createFact(params: {
  id: string;
  tenantId: string;
  bankId: string;
  entity?: string;
  category?: FactCategory;
  claim: string;
  confidence?: number;
  importance?: number;
  occurrences?: number;
  provenance: Provenance;
}): Fact {
  const now = new Date();
  return {
    id: params.id,
    kind: "fact",
    tenantId: params.tenantId,
    bankId: params.bankId,
    entity: params.entity ?? "general",
    category: params.category ?? "workflow",
    claim: params.claim,
    confidence: params.confidence ?? 0.5,
    importance: params.importance ?? 50,
    occurrences: params.occurrences ?? 1,
    provenance: params.provenance,
    createdAt: now,
    lastValidatedAt: now,
  };
}

export function createInsight(params: {
  id: string;
  tenantId: string;
  bankId: string;
  type: InsightType;
  depth: 1 | 2 | 3;
  claim: string;
  supportingNodes: string[];
  contradictingNodes?: string[];
  confidence?: number;
  stability?: number;
  importance?: number;
  parentInsights?: string[];
}): Insight {
  const now = new Date();
  return {
    id: params.id,
    kind: "insight",
    tenantId: params.tenantId,
    bankId: params.bankId,
    type: params.type,
    depth: params.depth,
    claim: params.claim,
    supportingNodes: params.supportingNodes,
    contradictingNodes: params.contradictingNodes ?? [],
    confidence: params.confidence ?? 0.3,
    stability: params.stability ?? 0.5,
    predictiveValue: null,
    parentInsights: params.parentInsights ?? [],
    status: "candidate",
    predictionCount: 0,
    correctPredictions: 0,
    importance: params.importance ?? 80,
    createdAt: now,
    lastValidatedAt: now,
  };
}

export function createEvidenceLink(params: {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: EvidenceRelation;
  weight?: number;
}): EvidenceLink {
  return {
    id: params.id,
    sourceNodeId: params.sourceNodeId,
    targetNodeId: params.targetNodeId,
    relation: params.relation,
    weight: params.weight ?? 1.0,
    createdAt: new Date(),
  };
}
