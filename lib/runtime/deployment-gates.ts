export type DeploymentResponse = Readonly<{
  health: { ok: boolean; data?: { status?: string; components?: { api?: string; canonicalStore?: string } } };
  ready: { ok: boolean; data?: { status?: string } };
  healthStatus: number;
  readyStatus: number;
  authStatus: number;
  staticStatus: number;
  staticHtml: string;
  latencyMs: { health: number; ready: number; auth: number; static: number };
}>;

export function assertDeploymentResponse(response: DeploymentResponse, maxLatencyMs: number): void {
  if (response.healthStatus !== 200 || !response.health.ok || response.health.data?.status !== 'ok') {
    throw new Error('health gate failed');
  }
  if (response.health.data.components?.api !== 'ok' || response.health.data.components.canonicalStore !== 'healthy') {
    throw new Error('canonical store health gate failed');
  }
  if (response.readyStatus !== 200 || !response.ready.ok || response.ready.data?.status !== 'ready') {
    throw new Error('readiness gate failed');
  }
  if (response.authStatus !== 401) throw new Error('authentication enforcement gate failed');
  if (response.staticStatus !== 200 || !response.staticHtml.includes('_next/static')) throw new Error('static asset gate failed');
  const slow = Object.entries(response.latencyMs).find(([, value]) => value > maxLatencyMs);
  if (slow) throw new Error(`latency gate failed for ${slow[0]}: ${slow[1]}ms > ${maxLatencyMs}ms`);
}
