import type { ApiEnvelope } from '@/lib/runtime/sdk/client';
import type { RuntimeHealth } from './ui-mode';

export const fetchRuntimeHealth = async (fetcher: typeof fetch = fetch): Promise<RuntimeHealth> => {
  try {
    const response = await fetcher('/api/v1/health', { cache: 'no-store' });
    const body = (await response.json()) as ApiEnvelope<{ status?: string }>;
    if (!response.ok || !body.ok) return { status: 'unavailable', requestId: body.requestId, message: body.error ?? `Health check returned ${response.status}.` };
    return { status: body.data?.status === 'ok' ? 'healthy' : 'unavailable', requestId: body.requestId, message: body.data?.status === 'ok' ? 'API reachable; canonical store status is reported separately.' : 'API health is degraded.' };
  } catch {
    return { status: 'unavailable', message: 'Runtime API is unreachable.' };
  }
};

