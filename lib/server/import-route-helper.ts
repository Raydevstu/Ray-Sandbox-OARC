export type ImportAction = "start" | "stop" | "once";

export interface ParsedImportBody {
  action: ImportAction;
  bankId: string;
  path: string;
}

export function parseImportBody(body: any): ParsedImportBody {
  const action = String(body?.action ?? "");
  if (action !== "start" && action !== "stop" && action !== "once") {
    throw new Error(`invalid import action: ${action}`);
  }
  const bankId = String(body?.bankId ?? "default");
  const path = String(body?.path ?? "");
  if ((action === "start" || action === "once") && !path) {
    throw new Error("import path is required for start/once");
  }
  return { action, bankId, path };
}

export function nextPollIn(requestedMs: number): number {
  if (!Number.isFinite(requestedMs)) return 5000;
  return Math.max(5000, Math.min(300_000, Math.floor(requestedMs)));
}
