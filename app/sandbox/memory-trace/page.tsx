import { FileText, GitBranch, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { buildRetrievalTrace } from '@/lib/runtime/retrieval-trace';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

export const dynamic = 'force-dynamic';

export default async function MemoryTracePage({ searchParams }: { searchParams?: Promise<{ projectId?: string; query?: string }> }) {
  const params = await searchParams;
  const projectId = params?.projectId ?? process.env.APEX_AUDIT_PROJECT_ID ?? 'current-project';
  const query = params?.query ?? 'PostgreSQL persistence';
  const tenantId = process.env.APEX_AUDIT_TENANT_ID;
  const bankId = process.env.APEX_AUDIT_BANK_ID;
  const configured = Boolean(tenantId && bankId && isRuntimeStoreConfigured());
  const repository = configured ? createRuntimeRepository({ tenantId: tenantId!, bankId: bankId! }) : null;
  const records = repository ? await repository.listProjectMemory({ tenantId: tenantId!, bankId: bankId! }, projectId) : [];
  const graph = repository ? await repository.listGraph({ tenantId: tenantId!, bankId: bankId! }) : { entities: [], edges: [] };
  const trace = buildRetrievalTrace(records, query);
  return <main className="max-w-[1200px] mx-auto space-y-4" aria-labelledby="memory-trace-title">
    <Card glow><CardHeader title="Memory Trace" subtitle="Evidence-backed retrieval lineage from durable project memory." icon={<GitBranch size={15} />} /><div className="flex flex-wrap gap-2 text-xs text-muted"><span>Project <b className="text-ink">{projectId}</b></span><span>·</span><span>Query <b className="text-ink">{query}</b></span><span>·</span><span>{trace.items.length} selected memories</span></div></Card>
    <h1 id="memory-trace-title" className="sr-only">Memory Trace</h1>
    {!configured && <Card><p className="text-sm text-muted">Canonical PostgreSQL trace scope is not configured.</p></Card>}
    {trace.gaps.length > 0 && <Card><CardHeader title="Trace gaps" subtitle="Missing evidence is surfaced rather than hidden." icon={<ShieldCheck size={15} />} />{trace.gaps.map((gap) => <p key={gap} className="border-t border-border-soft py-2 text-sm text-muted">{gap}</p>)}</Card>}
    <Card><CardHeader title="Evidence graph" subtitle="Each selected memory retains its source, rationale, confidence, and temporal metadata." icon={<FileText size={15} />} />{trace.items.length === 0 ? <p className="text-sm text-muted">No evidence-backed memory matched this query.</p> : <div className="space-y-3">{trace.items.map((item) => <article key={item.recordId} className="rounded-lg border border-border-soft bg-surface-2 p-3"><div className="flex flex-wrap items-center gap-2"><Badge>{item.status}</Badge><span className="font-mono text-xs text-faint">{item.recordId}</span><span className="text-xs text-muted">confidence {item.confidence.toFixed(2)}</span></div><p className="mt-2 text-sm text-ink">Selection rationale: {item.rationale}</p><p className="mt-1 text-xs text-muted">Source evidence: {item.evidenceReferences.join(', ')}</p><p className="mt-1 text-xs text-muted">Observed {item.source.timestamp ?? item.createdAt} · updated {item.updatedAt}</p></article>)}</div>}</Card>
    <Card><CardHeader title="Typed graph context" subtitle={`${graph.entities.length} entities · ${graph.edges.length} temporal relationships`} icon={<GitBranch size={15} />} />{graph.edges.length === 0 ? <p className="text-sm text-muted">No typed graph relationships are available for this scope.</p> : <div className="space-y-2">{graph.edges.slice(0, 50).map((edge) => <div key={edge.id} className="rounded-lg border border-border-soft bg-surface-2 p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><Badge>{edge.type}</Badge><span className="font-mono text-faint">{edge.from} → {edge.to}</span></div><p className="mt-1 text-muted">Valid {edge.validFrom} → {edge.validTo ?? 'current'} · evidence: {edge.evidenceIds.join(', ') || 'none'}</p></div>)}</div>}</Card>
  </main>;
}
