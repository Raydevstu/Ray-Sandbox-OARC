import { NextResponse } from 'next/server';
import { getCaptureStatus } from '@/lib/runtime/capture-status';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, data: getCaptureStatus() });
}
