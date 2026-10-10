import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { createMemoryPolicy } from '@/lib/runtime/memory-policy';

const ScopeSchema = z.object({ tenantId: z.string().trim().min(1), bankId: z.string().trim().min(1), projectId: z.string().trim().min(1) }).strict();
const PolicyInputSchema = z.object({ policyId: z.string().trim().min(1), version: z.number().int().positive(), scope: z.object({ bankId: z.string().trim().min(1).optional(), projectId: z.string().trim().min(1).optional(), userId: z.string().trim().min(1).optional() }).strict(), retentionDays: z.number().int().positive(), minimumConfidence: z.number().min(0).max(1), approvalRequiredFor: z.array(z.string().min(1)), connectorAllowlist: z.array(z.string().min(1)), model: z.object({ provider: z.string().min(1), model: z.string().min(1), maxCostUsd: z.number().nonnegative() }).strict(), explainability: z.object({ required: z.literal(true), includeSource: z.literal(true), includeRationale: z.literal(true) }).strict(), audit: z.object({ createdBy: z.string().min(1), changeReason: z.string().min(1) }).partial().optional() }).strict();

async function authorized(request: Request, scope: z.infer<typeof ScopeSchema>) {
  const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
  if (principal.tenantId !== scope.tenantId) throw new Error('scope denied');
  if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured');
  return createRuntimeRepository({ tenantId: scope.tenantId, bankId: scope.bankId });
}

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const scope = ScopeSchema.parse(params);
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const policies = await (await authorized(request, scope)).listMemoryPolicies({ tenantId: scope.tenantId, bankId: scope.bankId }, scope.projectId, limit);
    return NextResponse.json({ ok: true, data: policies });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid policy query' : error instanceof Error ? error.message : 'policy read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message === 'scope denied' ? 403 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    const source = body as Record<string, unknown>;
    const scope = ScopeSchema.parse({ tenantId: source.tenantId, bankId: source.bankId, projectId: source.projectId });
    const repository = await authorized(request, scope);
    const policy = createMemoryPolicy(PolicyInputSchema.parse((body as Record<string, unknown>).policy));
    if (policy.scope.projectId && policy.scope.projectId !== scope.projectId) throw new Error('policy project scope mismatch');
    await repository.saveMemoryPolicy({ tenantId: scope.tenantId, bankId: scope.bankId, projectId: scope.projectId, policy });
    return NextResponse.json({ ok: true, data: policy }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid policy request' : error instanceof Error ? error.message : 'policy write failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message === 'scope denied' ? 403 : 400 });
  }
}
