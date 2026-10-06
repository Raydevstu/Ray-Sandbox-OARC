import type { FeedbackRecord } from "@/lib/types";

export function recordFeedback(input: { factId: string; outcome: FeedbackRecord["outcome"]; note?: string; source?: FeedbackRecord["source"]; at?: string }, existing: FeedbackRecord[]): FeedbackRecord[] {
  if (!input.factId.trim()) throw new Error("Feedback requires a fact ID");
  const record: FeedbackRecord = { id: `feedback-${input.factId}-${existing.length + 1}`, factId: input.factId, outcome: input.outcome, note: input.note?.trim() ?? "", at: input.at ?? new Date().toISOString(), source: input.source ?? "user" };
  return [...existing, record].slice(-200);
}
