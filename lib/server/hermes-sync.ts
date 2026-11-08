import {
  normalizeCwd,
  newMessagesSince,
  type HermesMessage,
  type HermesSession,
} from "./hermes-sessions";
import { structureTranscript } from "../engine/chat-structure";
import type { StoredFact } from "./pg-lifecycle";

export interface SyncDeps {
  bankId: string;
  bankCwdKey: string;
  sessions: HermesSession[];
  readMessages: (sessionId: string) => HermesMessage[];
  getCursor: (bankId: string, sessionId: string) => number;
  setCursor: (bankId: string, sessionId: string, timestamp: number) => void;
  saveFacts: (facts: StoredFact[]) => Promise<void>;
}

export interface SyncReport {
  bankId: string;
  sessionsMatched: number;
  messagesImported: number;
}

export async function syncBankFromSessions(deps: SyncDeps): Promise<SyncReport> {
  let sessionsMatched = 0;
  let messagesImported = 0;
  for (const s of deps.sessions) {
    if (!s.cwd || normalizeCwd(s.cwd) !== deps.bankCwdKey) continue;
    sessionsMatched++;
    const cursor = deps.getCursor(deps.bankId, s.id);
    const fresh = newMessagesSince(deps.readMessages(s.id), cursor);
    if (fresh.length === 0) continue;
    const latest = fresh[fresh.length - 1].timestamp;
    const structured = structureTranscript(
      s.id,
      fresh.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
      deps.bankId
    ).map((f) => ({ ...f, provenance: { ...f.provenance, source: "hermes-sync" } }));
    if (structured.length === 0) continue;
    await deps.saveFacts(structured);
    messagesImported += fresh.length;
    deps.setCursor(deps.bankId, s.id, latest);
  }
  return { bankId: deps.bankId, sessionsMatched, messagesImported };
}
