import { authenticateRequest, authorize, authorizeProject } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { isRuntimeStoreConfigured, createRuntimeRepository } from '@/lib/runtime/repository';
import { projectDashboardMetrics } from '@/lib/runtime/project-dashboard-metrics';
import { readProjectDashboardSnapshot } from '@/lib/runtime/project-dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const projectId = query.get('projectId')?.trim();
  const bankId = query.get('bankId')?.trim();
  if (!projectId || !bankId) return new Response(JSON.stringify({ error: 'bankId and projectId are required' }), { status: 400 });
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const scope = { tenantId: principal.tenantId, bankId, projectId };
    authorize(principal, 'memory:read', scope);
    authorizeProject(principal, scope);
    if (!isRuntimeStoreConfigured()) return new Response(JSON.stringify({ state: 'unavailable', projectId }), { status: 503 });
    const repository = createRuntimeRepository(scope);
    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const publish = async () => controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(await readProjectDashboardSnapshot(scope, { metrics: projectDashboardMetrics, repository }))}\n\n`));
        await publish();
        unsubscribe = projectDashboardMetrics.subscribe(scope, () => void publish());
        heartbeat = setInterval(() => void publish(), 5_000);
      },
      cancel() { unsubscribe(); if (heartbeat) clearInterval(heartbeat); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const accessDenied = message.includes('permission') || message.includes('scope') || message.includes('project is not permitted');
    return new Response(JSON.stringify({ error: accessDenied ? 'access denied' : 'dashboard unavailable', projectId }), { status: accessDenied ? 403 : 503 });
  }
}
