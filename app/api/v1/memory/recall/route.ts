import { NextResponse } from 'next/server';
import { createRecallHandler } from '../../../../../lib/runtime/api-handlers';
import { createRuntimeRepository } from '../../../../../lib/runtime/repository';
import { readScope } from '../../../../../lib/runtime/api-handlers';

export async function POST(request: Request) {
  try { return await createRecallHandler(createRuntimeRepository(await readScope(request)))(request); }
  catch (error) { return NextResponse.json({ ok: false, requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(), error: error instanceof Error ? error.message : 'runtime repository unavailable', retryable: true }, { status: 503 }); }
}
