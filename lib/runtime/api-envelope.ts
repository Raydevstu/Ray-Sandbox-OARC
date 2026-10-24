import { NextResponse } from 'next/server';

export type ApiState = 'healthy' | 'empty' | 'queued' | 'degraded' | 'unavailable' | 'unauthorized' | 'unconfigured' | 'failed';
export type ApiTraceMeta = Readonly<{ traceId?: string; latencyMs?: number; inputTokens?: number; outputTokens?: number; costUsd?: number }>;
export function apiSuccess<T>(requestId: string, data: T, options: Readonly<{ workflowRunId?: string; state?: ApiState; trace?: ApiTraceMeta }> = {}, status = 200) {
  return NextResponse.json({ ok: true, requestId, workflowRunId: options.workflowRunId, state: options.state ?? 'healthy', data, trace: options.trace }, { status });
}
export function apiFailure(requestId: string, error: string, state: ApiState, status: number, options: Readonly<{ workflowRunId?: string; retryable?: boolean }> = {}) {
  return NextResponse.json({ ok: false, requestId, workflowRunId: options.workflowRunId, state, error, retryable: options.retryable ?? false }, { status });
}
