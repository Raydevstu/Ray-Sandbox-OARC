import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

const Scope = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1) }).strict();
const Body = Scope.extend({ promptId: z.string().min(1), version: z.number().int().positive(), content: z.string().min(1), createdAt: z.string().datetime().optional() });

async function repo(request: Request, scope: z.infer<typeof Scope>, permission: 'memory:read' | 'memory:write') {
  const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
  authorize(principal, permission, scope);
  if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured');
  return createRuntimeRepository({ tenantId: scope.tenantId, bankId: scope.bankId });
}

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const scope = Scope.parse(params);
    const data = await (await repo(request, scope, 'memory:read')).listPromptVersions(scope, scope.projectId, String(params.promptId ?? ''), 100);
    return NextResponse.json({ ok: true, requestId: crypto.randomUUID(), state: data.length ? 'healthy' : 'empty', data });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid prompt query' : error instanceof Error ? error.message : 'prompt read failed';
    return NextResponse.json({ ok: false, error: message, retryable: !message.includes('scope') }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    const input = Body.parse(await request.json());
    const repository = await repo(request, input, 'memory:write');
    const version = { tenantId: input.tenantId, bankId: input.bankId, projectId: input.projectId, promptId: input.promptId, version: input.version, content: input.content, createdAt: input.createdAt ?? new Date().toISOString() } as const;
    await repository.savePromptVersion(version);
    return NextResponse.json({ ok: true, requestId: crypto.randomUUID(), state: 'healthy', data: version }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid prompt request' : error instanceof Error ? error.message : 'prompt write failed';
    return NextResponse.json({ ok: false, error: message, retryable: !message.includes('scope') }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
