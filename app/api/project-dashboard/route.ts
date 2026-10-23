import { NextResponse } from 'next/server';
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
  if (!projectId || !bankId) return NextResponse.json({ error: 'bankId and projectId are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const scope = { tenantId: principal.tenantId, bankId, projectId };
    authorize(principal, 'memory:read', scope);
    authorizeProject(principal, scope);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ state: 'unavailable', projectId, error: 'canonical store is not configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    const snapshot = await readProjectDashboardSnapshot(scope, { metrics: projectDashboardMetrics, repository: createRuntimeRepository(scope) });
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'dashboard request failed';
    const accessDenied = message.includes('permission') || message.includes('scope') || message.includes('project is not permitted');
    return NextResponse.json({ error: accessDenied ? 'access denied' : 'dashboard unavailable', projectId }, { status: accessDenied ? 403 : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
