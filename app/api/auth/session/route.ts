import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateJwt } from '@/lib/runtime/auth/jwks';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';

const SessionSchema = z.union([z.object({ token: z.string().min(1) }).strict(), z.object({ mode: z.literal('local-owner') }).strict()]);
const cookie = (token: string, maxAge?: number) => `oarc_dashboard_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}${maxAge === undefined ? '; Max-Age=3600' : `; Max-Age=${maxAge}`}`;

export async function POST(request: Request) {
  try {
    const session = SessionSchema.parse(await request.json());
    if ('mode' in session) {
      if (!parseRuntimeConfig(process.env).allowDevelopmentPrincipal) throw new Error('local owner is disabled');
      return new NextResponse(null, { status: 204, headers: { 'Set-Cookie': cookie('local-owner') } });
    }
    const { token } = session;
    await authenticateJwt(token, parseRuntimeConfig(process.env));
    return new NextResponse(null, { status: 204, headers: { 'Set-Cookie': cookie(token) } });
  } catch {
    return NextResponse.json({ error: 'invalid session token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    return NextResponse.json({ subject: principal.subject, tenantId: principal.tenantId, permissions: [...principal.scopes].sort(), allowedProjectIds: [...principal.allowedProjectIds] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'session unavailable' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE() {
  return new NextResponse(null, { status: 204, headers: { 'Set-Cookie': cookie('', 0) } });
}
