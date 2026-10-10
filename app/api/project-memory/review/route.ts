import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { reviewProjectMemory } from '@/lib/runtime/memory-review';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), recordId: z.string().min(1), action: z.enum(['approve-supersession', 'mark-uncertain', 'invalidate']), reviewer: z.string().min(1), reason: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    if (principal.tenantId !== scope.tenantId) return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
    const repository = createRuntimeRepository(scope);
    const records = await repository.listProjectMemory(scope, input.projectId);
    const result = reviewProjectMemory(records, { action: input.action, recordId: input.recordId, reviewer: input.reviewer, reason: input.reason, at: new Date().toISOString() });
    await repository.upsertProjectMemory(result.record);
    await repository.appendProjectEvent(result.event);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid review request' : error instanceof Error ? error.message : 'review failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : 400 });
  }
}
