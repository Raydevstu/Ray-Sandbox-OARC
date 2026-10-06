import { countTokens, uid } from "@/lib/utils";
import { stripMemoryContext, type CaptureDiagnostics } from "./capture";

export type CommitPolicy = "manual" | "threshold" | "hybrid";
export interface CapturedMessage { id: string; role: "user" | "assistant" | "system"; text: string; capturedAt: string; tokens: number; diagnostics: CaptureDiagnostics; }
export interface SessionBuffer { messages: CapturedMessage[]; policy: CommitPolicy; maxPendingTokens: number; maxPendingMessages: number; keepRecentCount: number; }
export const DEFAULT_SESSION_BUFFER: SessionBuffer = { messages: [], policy: "hybrid", maxPendingTokens: 20000, maxPendingMessages: 8, keepRecentCount: 2 };

export function captureMessage(buffer: SessionBuffer, role: CapturedMessage["role"], rawText: string): SessionBuffer {
  const { text, diagnostics } = stripMemoryContext(rawText);
  if (!text) return buffer;
  const message: CapturedMessage = { id: uid("capture"), role, text, capturedAt: new Date().toISOString(), tokens: countTokens(text), diagnostics };
  return { ...buffer, messages: [...buffer.messages, message] };
}
export function pendingTokens(buffer: SessionBuffer): number { return buffer.messages.reduce((total, message) => total + message.tokens, 0); }
export function shouldAutoCommit(buffer: SessionBuffer): boolean {
  if (buffer.policy === "manual" || !buffer.messages.length) return false;
  return pendingTokens(buffer) >= buffer.maxPendingTokens || buffer.messages.length >= buffer.maxPendingMessages;
}
export function drainBuffer(buffer: SessionBuffer): { content: string; remainder: SessionBuffer } {
  const commitCount = Math.max(0, buffer.messages.length - (buffer.policy === "hybrid" ? buffer.keepRecentCount : 0));
  return { content: buffer.messages.slice(0, commitCount).map((message) => `${message.role}: ${message.text}`).join("\n"), remainder: { ...buffer, messages: buffer.messages.slice(commitCount) } };
}
