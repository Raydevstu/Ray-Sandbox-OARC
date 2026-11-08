export interface HermesToolCall {
  tool: string;
  args: Record<string, unknown>;
  source: "hindsight-mcp";
  at: number;
}

export function bridgeUrl(): string | null {
  const url = process.env.HERMES_BRIDGE_URL?.trim();
  return url ? url : null;
}

export function buildHermesToolCall(tool: string, args: Record<string, unknown>): HermesToolCall {
  return { tool, args, source: "hindsight-mcp", at: Date.now() };
}

export async function forwardToHermes<T>(tool: string, args: Record<string, unknown>): Promise<{ bridged: boolean; result: T | null }> {
  const url = bridgeUrl();
  if (!url) return { bridged: false, result: null };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildHermesToolCall(tool, args)),
    });
    if (!res.ok) return { bridged: false, result: null };
    const json = (await res.json()) as T;
    return { bridged: true, result: json };
  } catch {
    return { bridged: false, result: null };
  }
}
