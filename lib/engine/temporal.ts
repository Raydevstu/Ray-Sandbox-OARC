import type { MemoryFact, TemporalMemoryType, TemporalMetadata, TemporalPrecision, TemporalStatus } from "@/lib/types";

export type TemporalIntent = "none" | "current" | "historical" | "event" | "plan";
export type HistoryPolicy = "current" | "historical" | "all";

const EVENT_CUES = /\b(shipped|met|visited|moved|bought|started|finished|happened|did|worked)\b/i;
const STATE_CUES = /\b(is|are|works|lives|uses|has|currently|now)\b/i;
const PLAN_CUES = /\b(will|plan(?:s|ned)?|going to|next|intend(?:s|ed)?)\b/i;
const PREFERENCE_CUES = /\b(prefer(?:s|red)?|favorite|favourite|likes?|loves?|hates?|wants?)\b/i;
const RELATIONSHIP_CUES = /\b(friend|manager|works with|married|parent|colleague)\b/i;
const ABSENCE_CUES = /\b(no longer|never|doesn't|does not|without|haven't|hasn't)\b/i;

function precisionFor(text: string): TemporalPrecision {
  if (/\b\d{1,2}:\d{2}\b/.test(text)) return "datetime";
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(text)) return "day";
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(text)) return "month";
  if (/\b(?:19|20)\d{2}\b/.test(text)) return "year";
  if (/\b(?:today|yesterday|tomorrow|last|next|currently|now|recently)\b/i.test(text)) return "relative";
  return "unknown";
}

function classifyType(text: string): TemporalMemoryType {
  if (ABSENCE_CUES.test(text)) return "absence";
  if (PLAN_CUES.test(text)) return "plan";
  if (PREFERENCE_CUES.test(text)) return "preference";
  if (RELATIONSHIP_CUES.test(text)) return "relationship";
  if (STATE_CUES.test(text) && !EVENT_CUES.test(text)) return "state";
  return "event";
}

function classifyStatus(text: string, type: TemporalMemoryType): TemporalStatus {
  if (type === "plan") return "planned";
  if (/\b(currently|now|ongoing|still|works|lives|uses)\b/i.test(text)) return "ongoing";
  if (EVENT_CUES.test(text)) return "completed";
  return "unknown";
}

export function deriveTemporalMetadata(text: string): TemporalMetadata {
  const type = classifyType(text);
  const precision = precisionFor(text);
  return {
    type,
    status: classifyStatus(text, type),
    precision,
    confidence: precision === "unknown" ? 0.55 : 0.8,
    sourceText: text,
  };
}

export function classifyTemporalIntent(query: string): TemporalIntent {
  if (/\b(now|currently|today|latest|current)\b/i.test(query)) return "current";
  if (/\b(used to|formerly|previously|before|historical|back then)\b/i.test(query)) return "historical";
  if (/\b(will|plan|next|upcoming|intend)\b/i.test(query)) return "plan";
  if (/\b(when|what happened|what did|which day|which month|in \d{4})\b/i.test(query)) return "event";
  return "none";
}

type HistoryFact = Pick<MemoryFact, "id" | "supersedes" | "mentionedAt">;

export function resolveFactHistory<T extends HistoryFact>(facts: T[], policy: HistoryPolicy): T[] {
  const superseded = new Set(facts.map((fact) => fact.supersedes).filter((id): id is string => Boolean(id)));
  const ordered = [...facts].sort((a, b) => b.mentionedAt.localeCompare(a.mentionedAt));
  if (policy === "all") return ordered;
  if (policy === "current") return ordered.filter((fact) => !superseded.has(fact.id));
  return ordered.filter((fact) => superseded.has(fact.id));
}
