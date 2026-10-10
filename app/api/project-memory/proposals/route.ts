import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createMemoryPolicy } from '@/lib/runtime/memory-policy';
import { routeProposalForApproval } from '@/lib/runtime/proposal-approval';

const RequestSchema = z.object({
  tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), candidate: z.unknown(),
  policy: z.unknown(), timedOut: z.boolean().optional(), budgetExceeded: z.boolean().optional(), ambiguous: z.boolean().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    authorize(principal, 'memory:write', input);
    const disposition = routeProposalForApproval(input.candidate, createMemoryPolicy(input.policy as never), input);
    return NextResponse.json({ ok: true, data: { ...disposition, canonicalWrites: 0 } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid proposal review request' : error instanceof Error ? error.message : 'proposal review failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
