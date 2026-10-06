import { NextResponse } from 'next/server';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { id } = await context.params;
  return NextResponse.json({ ok: false, requestId, error: `memory lookup is not configured for ${id}`, retryable: true }, { status: 503 });
}
