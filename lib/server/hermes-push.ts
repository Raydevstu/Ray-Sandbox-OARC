import { normalizeCwd, newMessagesSince, buildSessionTranscript, type HermesMessage } from "./hermes-sessions";

export interface PushMessage {
  role: string;
  content: string;
  timestamp: number;
}

export interface ParsedPush {
  cwd: string;
  cwdKey: string;
  sessionId: string;
  bankName: string | null;
  messages: PushMessage[];
}

export interface BankCwdRow {
  bankId: string;
  cwdKey: string;
}

const MAX_MESSAGES = 500;
const MAX_CONTENT_CHARS = 4000;

export function bankIdForCwd(cwd: string): string {
  const leaf = cwd.replace(/\\/g, "/").replace(/\/$/, "").split("/").filter(Boolean).pop() ?? "bank";
  const slug = leaf.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "bank";
}

export function findBankForCwd(rows: BankCwdRow[], cwd: string): string | null {
  const key = normalizeCwd(cwd);
  for (const r of rows) {
    if (r.cwdKey && normalizeCwd(r.cwdKey) === key) return r.bankId;
  }
  return null;
}

export function parsePushBody(body: unknown): ParsedPush {
  if (!body || typeof body !== "object") throw new Error("push body must be an object");
  const b = body as Record<string, unknown>;
  const cwd = String(b.cwd ?? "").trim();
  if (!cwd) throw new Error("cwd is required");
  const sessionId = String(b.sessionId ?? "").trim();
  if (!sessionId) throw new Error("sessionId is required");
  const raw = b.messages;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("messages must be a non-empty array");
  const messages: PushMessage[] = [];
  for (const m of raw.slice(0, MAX_MESSAGES)) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const content = String(r.content ?? "").trim().slice(0, MAX_CONTENT_CHARS);
    if (!content) continue;
    messages.push({
      role: String(r.role ?? "user").toLowerCase() === "assistant" ? "assistant" : "user",
      content,
      timestamp: Number(r.timestamp ?? 0),
    });
  }
  if (messages.length === 0) throw new Error("messages must contain at least one non-empty message");
  const bankName = typeof b.bankName === "string" && b.bankName.trim() ? b.bankName.trim() : null;
  return { cwd, cwdKey: normalizeCwd(cwd), sessionId, bankName, messages };
}

export function parseTranscriptText(text: string): PushMessage[] {
  const lines = String(text ?? "").split(/\r?\n/);
  const messages: PushMessage[] = [];
  let now = Date.now();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const labeled = trimmed.match(/^(user|assistant)\s*:\s*(.*)$/i);
    if (labeled) {
      messages.push({ role: labeled[1].toLowerCase() as "user" | "assistant", content: labeled[2].trim(), timestamp: now++ });
    } else if (messages.length > 0) {
      const last = messages[messages.length - 1];
      last.content = `${last.content}\n${trimmed}`.slice(0, MAX_CONTENT_CHARS);
    } else {
      messages.push({ role: "user", content: trimmed, timestamp: now++ });
    }
  }
  return messages;
}

export function toHermesMessages(sessionId: string, messages: PushMessage[]): HermesMessage[] {
  return messages.map((m) => ({ sessionId, role: m.role, content: m.content, timestamp: m.timestamp }));
}

export function pushTranscript(sessionId: string, messages: PushMessage[], cursor: number): string | null {
  const fresh = newMessagesSince(toHermesMessages(sessionId, messages), cursor);
  if (fresh.length === 0) return null;
  return buildSessionTranscript(sessionId, fresh);
}
