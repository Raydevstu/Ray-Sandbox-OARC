import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowLeft, CircleAlert, Download, ListChecks, ShieldCheck } from 'lucide-react';
import { GET as getConflicts } from '@/app/api/project-memory/conflicts/route';
import { GET as getPolicies } from '@/app/api/project-memory/policies/route';
import { GET as getEvents } from '@/app/api/project-memory/events/route';
import { GET as getExport } from '@/app/api/project-memory/export/route';
import { loadAuthenticatedOperatorSectionData, loadOperatorSectionData, type OperatorSection, type OperatorScope } from '@/lib/runtime/operator-section-data';
import type { OperationalState } from '@/lib/runtime/operational-state';

const sections = {
  conflicts: { title: 'Conflicts', description: 'Reviewable uncertainty and correction decisions.', icon: CircleAlert },
  policies: { title: 'Policies', description: 'Versioned approval, retention, and explainability rules.', icon: ShieldCheck },
  events: { title: 'Events', description: 'Durable event-ledger records and replay history.', icon: ListChecks },
  exports: { title: 'Exports', description: 'Auditable manifests and report downloads.', icon: Download },
} as const;

const routeHandlers: Record<OperatorSection, (request: Request) => Promise<Response>> = {
  conflicts: getConflicts,
  policies: getPolicies,
  events: getEvents,
  exports: getExport,
};

export default async function OperatorSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Partial<OperatorScope>> }) {
  const { section } = await params;
  const query = await searchParams;
  const item = sections[section as keyof typeof sections];
  if (!item) return <div className="mx-auto max-w-3xl rounded-xl border border-border-soft bg-surface p-6"><h1 className="text-lg font-semibold text-ink">Operator section unavailable</h1><p className="mt-2 text-sm text-muted">This workspace section does not exist.</p></div>;
  const Icon = item.icon;
  const scope = query.tenantId && query.bankId && query.projectId ? { tenantId: query.tenantId, bankId: query.bankId, projectId: query.projectId } : undefined;
  const incoming = await headers();
  const forwarded = new Headers();
  for (const name of ['authorization', 'x-dev-subject', 'x-dev-tenant-id', 'x-dev-scopes']) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  let data: { endpoint: string; state: OperationalState; summary: string; count?: number } = loadOperatorSectionData(section as OperatorSection);
  if (scope) {
    const selectedSection = section as OperatorSection;
    const fetchProtectedRoute = async (input: string | URL, init?: RequestInit) => routeHandlers[selectedSection](new Request(String(input), { headers: init?.headers }));
    try { data = await loadAuthenticatedOperatorSectionData(selectedSection, scope, forwarded, fetchProtectedRoute); }
    catch { data = { ...loadOperatorSectionData(section as OperatorSection, 'failed'), count: 0 }; }
  }
  const routeHref = scope ? `${data.endpoint}?${new URLSearchParams(scope).toString()}` : data.endpoint;
  return <div className="mx-auto max-w-3xl space-y-4"><Link href="/sandbox/operator" className="inline-flex items-center gap-2 text-xs text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowLeft size={14} aria-hidden="true" />Back to operator workspace</Link><section className="rounded-xl border border-border-soft bg-surface p-6" aria-labelledby="operator-section-heading"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} aria-hidden="true" /></span><div><h1 id="operator-section-heading" className="text-xl font-bold text-ink">{item.title}</h1><p className="mt-1 text-sm text-muted">{item.description}</p></div></div><div className="mt-6 rounded-lg border border-border-soft bg-bg-soft p-4 text-sm text-muted" role="status"><strong className="text-ink">{data.state}</strong><p className="mt-1">{data.summary}</p>{typeof data.count === 'number' && <p className="mt-3 text-xs">{data.count} durable item{data.count === 1 ? '' : 's'} in this authenticated project scope.</p>}<p className="mt-3 text-xs">The connected route remains protected and receives only the requested project scope.</p><a className="mt-3 inline-flex rounded border border-border-soft px-3 py-2 text-xs text-accent hover:border-accent-border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" href={routeHref} target="_blank" rel="noreferrer">Open protected data route</a></div></section></div>;
}
