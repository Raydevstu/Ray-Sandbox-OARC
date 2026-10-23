import { NextResponse } from 'next/server';
import { runtimeMetrics } from '@/lib/runtime/live-metrics';

export const dynamic = 'force-dynamic';

const isLocalDevelopment = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const sseSnapshot = () => `event: snapshot\ndata: ${JSON.stringify(runtimeMetrics.snapshot())}\n\n`;

export async function GET(request: Request) {
  if (!isLocalDevelopment()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (new URL(request.url).searchParams.get('stream') !== '1') {
    return NextResponse.json(runtimeMetrics.snapshot(), { headers: { 'Cache-Control': 'no-store' } });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const publish = () => controller.enqueue(encoder.encode(sseSnapshot()));
      publish();
      unsubscribe = runtimeMetrics.subscribe(publish);
      heartbeat = setInterval(publish, 5_000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
