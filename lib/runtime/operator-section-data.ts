import type { OperationalState } from './operational-state';

const endpoints = {
  conflicts: '/api/project-memory/conflicts',
  policies: '/api/project-memory/policies',
  events: '/api/project-memory/events',
  exports: '/api/project-memory/export',
} as const;

export type OperatorSection = keyof typeof endpoints;
export type OperatorScope = Readonly<{ tenantId: string; bankId: string; projectId: string }>;
type RouteFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const summaries: Record<OperationalState, string> = {
  empty: 'No durable conflicts are available in the authenticated project scope.',
  queued: 'The authenticated operation is accepted and awaiting durable completion.',
  healthy: 'Durable project data is available and policy checks succeeded.',
  degraded: 'A partial result is available; inspect the route response for recovery details.',
  unavailable: 'The canonical runtime cannot serve this request right now.',
  failed: 'The request reached the runtime but could not complete safely.',
  unauthorized: 'Sign in with a project-scoped operator identity to inspect durable data.',
};

export const loadOperatorSectionData = (section: OperatorSection, state: OperationalState = 'unauthorized') => ({
  endpoint: endpoints[section],
  state,
  summary: summaries[state],
});

const countFor = (section: OperatorSection, data: unknown): number => {
  if (section === 'exports') return 1;
  if (!data || typeof data !== 'object') return 0;
  const payload = data as Record<string, unknown>;
  const collection = section === 'conflicts' ? payload.conflicts : section === 'events' ? payload.events : payload;
  return Array.isArray(collection) ? collection.length : 0;
};

export const loadAuthenticatedOperatorSectionData = async (section: OperatorSection, scope: OperatorScope, requestHeaders: HeadersInit, fetcher: RouteFetcher = fetch, origin = 'http://operator.local') => {
  const query = new URLSearchParams(scope).toString();
  const response = await fetcher(`${origin}${endpoints[section]}?${query}`, { headers: requestHeaders, cache: 'no-store' });
  if (response.status === 401 || response.status === 403) return { ...loadOperatorSectionData(section, 'unauthorized'), count: 0 };
  if (response.status === 503) return { ...loadOperatorSectionData(section, 'unavailable'), count: 0 };
  if (!response.ok) return { ...loadOperatorSectionData(section, 'failed'), count: 0 };
  const data = await response.json().catch(() => undefined) as { data?: unknown; state?: OperationalState } | undefined;
  const state = data?.state ?? (countFor(section, data?.data ?? data) === 0 ? 'empty' : 'healthy');
  return { ...loadOperatorSectionData(section, state), count: countFor(section, data?.data ?? data) };
};
