export interface HermesSession {
  id: string;
  cwd: string;
  lastActivity: number;
  messageCount: number;
}

export interface HermesMessage {
  sessionId: string;
  role: string;
  content: string;
  timestamp: number;
}

export function normalizeCwd(cwd: string): string {
  return cwd.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

export function cwdToBankKey(_root: string, watchPath: string): string {
  const trimmed = watchPath.trim().replace(/\\/g, "/").replace(/\/$/, "");
  const leaf = trimmed.split("/").filter(Boolean).pop() ?? "";
  return leaf.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function sessionKey(session: HermesSession): string {
  return normalizeCwd(session.cwd);
}

export function buildSessionTranscript(sessionId: string, messages: HermesMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.sessionId !== sessionId) continue;
    const text = (m.content ?? "").trim();
    if (!text) continue;
    if (m.role === "user") lines.push(`User: ${text}`);
    else if (m.role === "assistant") lines.push(`Assistant: ${text}`);
    else lines.push(`${m.role}: ${text}`);
  }
  return lines.join("\n");
}

export function newMessagesSince(messages: HermesMessage[], cursor: number): HermesMessage[] {
  return messages.filter((m) => m.timestamp > cursor).sort((a, b) => a.timestamp - b.timestamp);
}
