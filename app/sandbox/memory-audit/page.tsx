import { AlertTriangle, CheckCircle2, CircleDashed, FileWarning, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { auditStatusLabel, buildMemoryAudit } from "@/lib/runtime/memory-audit";
import type { ProjectEvent, ProjectMemoryRecord } from "@/lib/runtime/contracts";
import { checkRuntimeStore, createRuntimeRepository, isRuntimeStoreConfigured, type RuntimeStoreStatus } from "@/lib/runtime/repository";
import { readProjectMemoryAudit } from "@/lib/runtime/audit-read";
import { getCaptureStatus, reconcilePersistedCaptureStatus } from "@/lib/runtime/capture-status";
import { MemoryReviewPanel } from "@/components/oarc-v2/memory-review-panel";

const STATUS_COLORS: Record<string, string> = { verified: "var(--ok)", active: "var(--accent)", pending: "var(--warn)", blocked: "var(--danger)", stale: "var(--warn)", conflict: "var(--danger)", uncertain: "var(--muted)", superseded: "var(--faint)", uncaptured: "var(--danger)" };
const iconFor = (status: string) => status === "verified" ? <CheckCircle2 size={14} /> : status === "blocked" || status === "conflict" ? <AlertTriangle size={14} /> : status === "uncaptured" ? <FileWarning size={14} /> : <CircleDashed size={14} />;

export const dynamic = "force-dynamic";
export default async function MemoryAuditPage({ searchParams }: { searchParams?: Promise<{ projectId?: string }> }) {
  const query = await searchParams;
  const projectId = query?.projectId ?? process.env.APEX_AUDIT_PROJECT_ID ?? "current-project";
  const tenantId = process.env.APEX_AUDIT_TENANT_ID;
  const bankId = process.env.APEX_AUDIT_BANK_ID;
  let records: readonly ProjectMemoryRecord[] = [];
  let events: readonly ProjectEvent[] = [];
  let capture = getCaptureStatus();
  let storeStatus: RuntimeStoreStatus = "not_configured";
  const gaps: string[] = ["Cross-platform capture is only available where an export or connector is supplied."];
  if (isRuntimeStoreConfigured() && tenantId && bankId) {
    storeStatus = await checkRuntimeStore();
    if (storeStatus === "healthy") {
      try { const repository = createRuntimeRepository({ tenantId, bankId }); const auditRead = await readProjectMemoryAudit(repository, { scope: { tenantId, bankId }, projectId }); records = auditRead.records; events = await repository.listProjectEvents({ tenantId, bankId }, projectId); capture = reconcilePersistedCaptureStatus(capture, events.length); }
      catch { storeStatus = "unavailable"; gaps.unshift("Live PostgreSQL audit data is temporarily unavailable; showing an explicit empty state."); }
    } else gaps.unshift(storeStatus === "schema_unready" ? "Live PostgreSQL is reachable, but the audit schema is not ready." : "Live PostgreSQL audit data is temporarily unavailable; showing an explicit empty state.");
  } else gaps.unshift("Live audit scope is not configured; set APEX_AUDIT_TENANT_ID and APEX_AUDIT_BANK_ID.");
  const audit = buildMemoryAudit(projectId, records, gaps);
  const statusOrder = ["verified", "active", "pending", "blocked", "stale", "conflict", "uncertain", "superseded", "uncaptured"];
  return <div className="max-w-[1400px] mx-auto space-y-4">
    <Card glow><CardHeader title="Project memory audit" subtitle="Read-only view of what is captured, verified, stale, conflicting, or missing." icon={<ShieldCheck size={15} />} /><div className="flex flex-wrap gap-2 text-xs text-muted"><span>Project <b className="text-ink">{audit.projectId}</b></span><span>·</span><span>{audit.total} canonical records</span><span>·</span><span>{audit.captureGaps.length} capture gaps</span><span>·</span><span>Capture <b className="text-ink">{capture.state}</b> ({capture.processed} processed / {capture.failed} failed)</span><span>·</span><span>Store <b className="text-ink">{storeStatus.replace('_', ' ')}</b></span></div></Card>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{statusOrder.map((status) => <Card key={status} className="p-3"><div className="flex items-center gap-2 text-muted">{iconFor(status)}<span className="text-xs">{auditStatusLabel(status as never)}</span></div><p className="text-2xl font-semibold text-ink mt-2">{audit.counts[status as keyof typeof audit.counts]}</p></Card>)}</div>
    <Card><CardHeader title="Capture gaps" subtitle="Unavailable exports and connectors remain visible instead of being treated as project truth." icon={<FileWarning size={15} />} />{audit.captureGaps.map((gap) => <div key={gap} className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-muted mb-2">{gap}</div>)}</Card>
    <Card><CardHeader title="Run event history" subtitle="Ordered project events used to build the current projection; expand any event for raw lifecycle provenance." />{tenantId && bankId && <form action="/api/project-memory/manifest" method="get" target="_blank" className="mb-3 flex flex-wrap items-end gap-2"><input type="hidden" name="tenantId" value={tenantId} /><input type="hidden" name="bankId" value={bankId} /><input type="hidden" name="projectId" value={projectId} /><label htmlFor="audit-replay-sequence" className="text-[11px] text-muted">Replay through sequence<input id="audit-replay-sequence" name="atSequence" type="number" min="1" inputMode="numeric" placeholder="Latest" className="mt-1 block w-28 rounded border border-border-soft bg-bg px-2 py-1.5 text-xs text-ink" /></label><input type="hidden" name="format" value="markdown" /><button type="submit" className="chip hover:border-accent-border">Open replay manifest</button></form>}{events.length === 0 ? <div className="rounded-lg border border-border-soft bg-surface-2 p-5 text-sm text-muted">No project events are connected to this scope.</div> : <div className="space-y-2">{[...events].reverse().slice(0, 25).map((event) => <details key={event.id} className="border-t border-border-soft py-2 text-xs"><summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-mono text-faint">#{event.sequence}</span><span className="font-medium text-ink">{event.type}</span><span className="text-faint">{new Date(event.occurredAt).toISOString()}</span><span className="text-muted">{Object.keys(event.payload).join(", ") || "no payload"}</span></summary><pre className="mt-2 overflow-auto rounded border border-border-soft bg-surface-2 p-3 text-[11px] text-muted" data-testid={`event-payload-${event.id}`}>{JSON.stringify(event.payload, null, 2)}</pre></details>)}</div>}</Card>
    <Card><CardHeader title="Canonical records" subtitle="Records are shown only after provenance-linked extraction and governance." />{audit.records.length === 0 ? <div className="rounded-lg border border-border-soft bg-surface-2 p-5 text-sm text-muted">No canonical records are connected to this view. Raw conversation and evidence events must pass extraction and governance before appearing here.</div> : audit.records.map((record) => <div key={record.id} className="border-t border-border-soft py-3"><div className="flex flex-wrap items-center gap-2"><Badge>{record.status}</Badge><span className="text-sm font-medium text-ink">{record.title}</span><span className="text-[11px] text-faint">confidence {record.confidence.toFixed(2)}</span></div><p className="text-xs text-muted mt-1">{record.content}</p>{(record.status === 'conflict' || record.status === 'uncertain' || record.status === 'stale') && tenantId && bankId && <MemoryReviewPanel tenantId={tenantId} bankId={bankId} projectId={projectId} recordId={record.id} />}</div>)}</Card>
  </div>;
}
