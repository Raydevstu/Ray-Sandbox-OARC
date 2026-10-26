import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const WorkspaceSchema = z.object({ workspaceId: z.string().trim().min(1).max(256), workspaceLabel: z.string().trim().min(1).max(200).optional() }).strict();
const requestId = () => crypto.randomUUID();
const workspaceKey = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);

export async function GET(request: Request) {
  const id = requestId();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    if (!principal.projectId || !principal.bankId) return apiFailure(id, 'authenticated project scope is not configured', 'unconfigured', 409);
    return apiSuccess(id, { tenantId: principal.tenantId, bankId: principal.bankId, projectId: principal.projectId, source: principal.source }, { state: 'healthy' });
  } catch {
    return apiFailure(id, 'onboarding authentication required', 'unauthorized', 401);
  }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    const input = WorkspaceSchema.parse(await request.json());
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    if (!principal.projectId || !principal.bankId) return apiFailure(id, 'authenticated project scope is not configured', 'unconfigured', 409);
    return apiSuccess(id, { workspaceId: input.workspaceId, workspaceKey: workspaceKey(input.workspaceId), workspaceLabel: input.workspaceLabel, tenantId: principal.tenantId, bankId: principal.bankId, projectId: principal.projectId, source: principal.source }, { state: 'healthy' });
  } catch (error) {
    if (error instanceof z.ZodError) return apiFailure(id, 'invalid workspace identity', 'failed', 400);
    return apiFailure(id, 'onboarding authentication required', 'unauthorized', 401);
  }
}
