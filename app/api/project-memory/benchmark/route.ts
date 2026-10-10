import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { benchmarkRunsMarkdown, sanitizeBenchmarkExportFilename, summarizeBenchmark, validateControlledBenchmark, type ControlledBenchmarkRun } from '@/lib/runtime/benchmark-contract';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

export const dynamic = 'force-dynamic';

const CaseSchema = z.object({
  caseId: z.string().min(1),
  mode: z.enum(['without-memory', 'local-memory', 'postgres-memory', 'manifest-memory']),
  answerScore: z.number().min(0).max(1),
  citationPrecision: z.number().min(0).max(1),
  unsupportedClaimRate: z.number().min(0).max(1),
  latencyMs: z.number().nonnegative(),
  retrievalLatencyMs: z.number().nonnegative(),
  queueDelayMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  persisted: z.boolean(),
  captureStatus: z.enum(['captured', 'partial', 'uncaptured']),
});
const RunSchema = z.object({ id: z.string().min(1), generatedAt: z.string().datetime(), corpusId: z.string().min(1), modelId: z.string().min(1), promptVersion: z.string().min(1), cases: z.array(CaseSchema).min(1), evidence: z.enum(['synthetic', 'live-codex', 'replay']) });
const EnvelopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), run: RunSchema });

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const envelope = EnvelopeSchema.parse(await request.json());
    if (principal.tenantId !== envelope.tenantId) return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
    const run = envelope.run as ControlledBenchmarkRun;
    validateControlledBenchmark(run);
    if (run.evidence === 'live-codex' && !isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured for live benchmark persistence' }, { status: 503 });
    if (isRuntimeStoreConfigured()) await createRuntimeRepository({ tenantId: envelope.tenantId, bankId: envelope.bankId }).saveBenchmarkRun({ tenantId: envelope.tenantId, bankId: envelope.bankId }, envelope.projectId, run);
    return NextResponse.json({ ok: true, data: { run, summary: summarizeBenchmark(run) } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid benchmark payload' : error instanceof Error ? error.message : 'benchmark validation failed';
    const status = message.includes('credential') ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), limit: z.coerce.number().int().positive().max(100).optional(), format: z.enum(['json', 'markdown']).optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    if (principal.tenantId !== query.tenantId) return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: query.tenantId, bankId: query.bankId };
    const runs = await createRuntimeRepository(scope).listBenchmarkRuns(scope, query.projectId, query.limit ?? 20);
    if (query.format === 'markdown') return new Response(benchmarkRunsMarkdown(query.projectId, runs), { status: 200, headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="${sanitizeBenchmarkExportFilename(query.projectId)}"` } });
    return NextResponse.json({ ok: true, data: { projectId: query.projectId, runs } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid benchmark query' : error instanceof Error ? error.message : 'benchmark read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : 400 });
  }
}
