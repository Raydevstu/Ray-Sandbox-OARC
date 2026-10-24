import { NextResponse } from 'next/server';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { checkRuntimeStore } from '@/lib/runtime/repository';
import { buildRuntimeTruth } from '@/lib/runtime/runtime-truth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = parseRuntimeConfig(process.env);
  const canonicalStore = await checkRuntimeStore();
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? process.env.NEXT_BUILD_ID;
  return NextResponse.json(buildRuntimeTruth({ ...config, canonicalStore, buildId }), { headers: { 'Cache-Control': 'no-store' } });
}
