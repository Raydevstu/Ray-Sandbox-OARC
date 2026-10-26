import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { parseContextConfigInput } from '@/lib/runtime/context-config';

const Scope = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), configId: z.string().min(1).default('context-default') }).strict();
const Body = Scope.extend({ version: z.number().int().positive(), settings: z.record(z.string(), z.unknown()), updatedAt: z.string().datetime().optional() });
const response = (data: unknown, state = 'healthy', status = 200) => NextResponse.json({ ok: true, requestId: crypto.randomUUID(), state, data }, { status });
async function repository(request: Request, scope: z.infer<typeof Scope>, permission: 'memory:read' | 'memory:write') {
  const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
  authorize(principal, permission, scope);
  if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured');
  return createRuntimeRepository(scope);
}
export async function GET(request: Request) {
  try { const scope = Scope.parse(Object.fromEntries(new URL(request.url).searchParams)); const data = await (await repository(request, scope, 'memory:read')).getContextConfig(scope, scope.projectId, scope.configId); return response(data, data ? 'healthy' : 'empty'); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid context query' : error instanceof Error ? error.message : 'context read failed'; return NextResponse.json({ ok: false, error: message, retryable: message.includes('store') }, { status: message.includes('credential') ? 401 : message.includes('permission') || message.includes('scope') ? 403 : message.includes('store') ? 503 : 400 }); }
}
export async function POST(request: Request) {
  try { const input = Body.parse(await request.json()); const validated = parseContextConfigInput(input); const config = { tenantId: input.tenantId, bankId: input.bankId, projectId: input.projectId, configId: validated.configId, version: validated.version, settings: validated.settings, updatedAt: input.updatedAt ?? new Date().toISOString() } as const; await (await repository(request, input, 'memory:write')).saveContextConfig(config); return response(config, 'healthy', 201); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid context request' : error instanceof Error ? error.message : 'context write failed'; return NextResponse.json({ ok: false, error: message, retryable: message.includes('store') }, { status: message.includes('credential') ? 401 : message.includes('permission') || message.includes('scope') ? 403 : message.includes('store') ? 503 : 400 }); }
}
