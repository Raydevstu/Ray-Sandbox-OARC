import Link from 'next/link';
import { Activity, Archive, BarChart3, BookOpenCheck, Boxes, CircleAlert, FileCheck2, GitBranch, KeyRound, ListChecks, ShieldCheck } from 'lucide-react';

const sections = [
  { href: '/sandbox', label: 'Health', detail: 'Runtime status, capture, and service posture.', icon: Activity },
  { href: '/sandbox/memory-audit', label: 'Evidence', detail: 'Provenance coverage and source lineage.', icon: FileCheck2 },
  { href: '/sandbox/memory-trace', label: 'Graph', detail: 'Recall paths, graph hops, and explanations.', icon: GitBranch },
  { href: '/sandbox/operator/conflicts', label: 'Conflicts', detail: 'Reviewable uncertainty and corrections.', icon: CircleAlert },
  { href: '/sandbox/operator/policies', label: 'Policies', detail: 'Approval, retention, and explainability rules.', icon: ShieldCheck },
  { href: '/sandbox/operator/events', label: 'Events', detail: 'Durable event and replay history.', icon: ListChecks },
  { href: '/sandbox/benchmarks', label: 'Benchmarks', detail: 'Versioned quality, latency, and cost reports.', icon: BarChart3 },
  { href: '/sandbox/operator/exports', label: 'Exports', detail: 'Auditable manifests and report downloads.', icon: Archive },
] as const;

export function OperatorWorkspace() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="operator-workspace">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Operator control plane</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Diagnose memory without reading logs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Follow health, evidence, graph, conflicts, policies, events, benchmarks, and exports from one authenticated workspace.</p>
      </div>

      <nav aria-label="Operator workspace sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map(({ href, label, detail, icon: Icon }) => (
          <Link key={label} href={href} className="group rounded-xl border border-border-soft bg-surface p-4 transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={16} aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{detail}</span></span>
            </div>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="operator-state-heading" className="rounded-xl border border-border-soft bg-surface p-4">
        <div className="flex items-center gap-2"><Boxes size={15} className="text-accent" aria-hidden="true" /><h2 id="operator-state-heading" className="text-sm font-semibold text-ink">Operational states</h2></div>
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
          {['Empty', 'Queued', 'Healthy', 'Degraded', 'Unavailable', 'Failed', 'Unauthorized'].map((state) => <span key={state} className="rounded-lg border border-border-soft bg-bg-soft px-3 py-2"><span className="font-semibold text-ink">{state}</span><span className="ml-1">is an explicit state, never an empty success.</span></span>)}
        </div>
      </section>

      <aside className="rounded-xl border border-accent-border bg-accent-soft/40 p-4 text-xs leading-relaxed text-muted" aria-label="Operator access note">
        <div className="flex items-center gap-2 font-semibold text-ink"><KeyRound size={14} className="text-accent" aria-hidden="true" />Authenticated operator access</div>
        <p className="mt-1">Unavailable or unauthorized data stays visible as a state with a recovery action; it is never presented as an empty report.</p>
      </aside>
    </div>
  );
}
