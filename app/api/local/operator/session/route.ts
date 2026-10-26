import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createLocalOperatorSession, destroyLocalOperatorSession, isLocalOperatorBridgeEnabled, listLocalOperatorScopes, LOCAL_OPERATOR_COOKIE, readLocalOperatorSession } from '@/lib/runtime/local-operator';

const RequestSchema = z.object({ scopeId: z.string().trim().min(1).max(100) }).strict();
const config = () => parseRuntimeConfig(process.env);
const sessionData = (session: ReturnType<typeof readLocalOperatorSession>) => session ? { subject: session.subject, scopeId: session.scopeId, label: session.label, tenantId: session.tenantId, bankId: session.bankId, projectId: session.projectId } : undefined;

export async function GET(request: Request) {
  const runtime = config();
  const session = readLocalOperatorSession(runtime, request);
  if (session) return NextResponse.json({ ok: true, state: 'healthy', data: sessionData(session) });
  return NextResponse.json({ ok: false, state: 'unauthorized', data: { availableScopes: listLocalOperatorScopes(runtime).map(({ id, label }) => ({ id, label })) }, error: isLocalOperatorBridgeEnabled(runtime) ? 'local operator session required' : 'local operator bridge is disabled' }, { status: 401 });
}

export async function POST(request: Request) {
  const runtime = config();
  try {
    if (!isLocalOperatorBridgeEnabled(runtime)) throw new Error('local operator bridge is disabled');
    const input = RequestSchema.parse(await request.json());
    const session = createLocalOperatorSession(runtime, input.scopeId);
    const response = NextResponse.json({ ok: true, state: 'healthy', data: sessionData(readLocalOperatorSession(runtime, new Request(request.url, { headers: { cookie: session.cookie } }))) }, { status: 201 });
    response.headers.set('set-cookie', `${session.cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid local operator session request' : error instanceof Error ? error.message : 'local operator session failed';
    const status = message.includes('disabled') ? 403 : 400;
    return NextResponse.json({ ok: false, state: status === 403 ? 'unauthorized' : 'failed', error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  destroyLocalOperatorSession(request.headers.get('cookie') ?? '');
  const response = NextResponse.json({ ok: true, state: 'healthy' });
  response.headers.set('set-cookie', `${LOCAL_OPERATOR_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return response;
}
