import type { DistilledFact } from "./distillation";
import type { Provenance } from "./memory-lifecycle";
import { extractEntities } from "./nlp";
import { calculateImportance } from "./importance";

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: number;
}

export type ChatOutcome = "decision" | "implementation" | "progress" | "failure" | "success" | "goal" | "note";

export type StructuredFact = DistilledFact & { provenance: Provenance };

const RULES: { outcome: ChatOutcome; re: RegExp }[] = [
  { outcome: "failure", re: /\b(fail|failed|failure|error|bug|broken|crash|rollback|revert|blocked|timeout)\b/i },
  { outcome: "success", re: /\b(shipped|deployed|fixed|done|working|merged|passed|passing|resolved|launched|verified)\b/i },
  { outcome: "decision", re: /\b(decided|decision|going with|chose|choose|option|approach|instead of|let'?s (go|use)|we will use)\b/i },
  { outcome: "goal", re: /\b(goal|target|milestone|deadline|plan to|want to|need to|objective|sprint)\b/i },
  { outcome: "progress", re: /\b(progress|wip|so far|update|currently|working on|in flight|underway|status)\b/i },
  { outcome: "implementation", re: /\b(implement|implementing|build|building|add|adding|create|creating|refactor|wire|wiring|migrat|write|wrote)\b/i },
];

const CATEGORY_FOR: Record<ChatOutcome, DistilledFact["category"]> = {
  decision: "decision",
  implementation: "implementation",
  progress: "progress",
  failure: "failure",
  success: "success",
  goal: "goal",
  note: "workflow",
};

const MAX_CHUNK_CHARS = 1200;

export function classifyOutcome(text: string): ChatOutcome {
  const t = String(text ?? "");
  for (const r of RULES) {
    if (r.re.test(t)) return r.outcome;
  }
  return "note";
}

function slugEntity(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "general";
}

function entityFor(text: string, bankId: string): string {
  const hits = extractEntities(text).filter((e) => e && e.length > 1 && e.length < 40);
  if (hits.length > 0) return slugEntity(hits[0]);
  return slugEntity(bankId);
}

export function structureTranscript(
  sessionId: string,
  messages: ChatMessage[],
  bankId: string
): StructuredFact[] {
  const clean = messages
    .filter((m) => m && m.content && m.content.trim())
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.trim() }));
  if (clean.length === 0) return [];

  const chunks: { role: string; content: string }[][] = [];
  let current: { role: string; content: string }[] = [];
  let chars = 0;
  for (const m of clean) {
    const line = `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`;
    if (current.length > 0 && m.role === "user" && current[0].role === "user") {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    if (chars + line.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(m);
    chars += line.length;
  }
  if (current.length > 0) chunks.push(current);

  return chunks.map((chunk) => {
    const joined = chunk.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n").slice(0, MAX_CHUNK_CHARS);
    const outcome = classifyOutcome(joined);
    const category = CATEGORY_FOR[outcome];
    const entity = entityFor(joined, bankId);
    const confidence = outcome === "note" ? 0.6 : 0.7;
    const importance = calculateImportance({ entity, content: joined, confidence, occurrences: 1, category });
    return {
      entity,
      category,
      content: joined,
      confidence,
      importance,
      occurrences: 1,
      provenance: { source: "hermes-push", turnId: sessionId, createdAt: Date.now() },
    };
  });
}
