'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Archive, BarChart3, Boxes, CircleAlert, FileCheck2, GitBranch, KeyRound, ListChecks, LogOut, ShieldCheck } from 'lucide-react';

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

type AvailableScope = Readonly<{ id: string; label: string }>;
type Session = Readonly<{ authenticated: boolean; subject?: string; scopeId?: string; label?: string; tenantId?: string; bankId?: string; projectId?: string; availableScopes?: readonly AvailableScope[] }>;
type SectionSummary = Readonly<{ state: string; canonicalStore?: string; count?: number; gaps?: number; rationales?: readonly string[]; runs?: number; corrections?: number; comparisons?: number; completed?: number }>;
type Evidence = Readonly<{ scope: Readonly<{ scopeId: string; label: string; projectId: string }>; health: SectionSummary; events: SectionSummary; trace: SectionSummary; conflicts: SectionSummary; policies: SectionSummary; evaluations: SectionSummary; replays: SectionSummary }>;

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function OperatorWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    setLoading(true);
    const response = await fetch('/api/local/operator/session', { cache: 'no-store' });
    const body = await response.json() as { data?: Session };
    setSession(response.ok ? { authenticated: true, ...body.data } : { authenticated: false, ...body.data });
    setLoading(false);
  };

  useEffect(() => { void loadSession(); }, []);

  useEffect(() => {
    if (!session?.authenticated) { setEvidence(null); return; }
    let active = true;
    void fetch('/api/local/operator/evidence', { cache: 'no-store' }).then(async (response) => ({ response, body: await response.json() as { data?: Evidence } })).then(({ response, body }) => { if (active && response.ok) setEvidence(body.data ?? null); }).catch(() => { if (active) setEvidence(null); });
    return () => { active = false; };
  }, [session]);

  const enterScope = async (scopeId: string) => {
    setLoading(true);
    const response = await fetch('/api/local/operator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scopeId }) });
    const body = await response.json() as { data?: Session };
    if (response.ok) setSession({ authenticated: true, ...body.data });
    setLoading(false);
  };

  const signOut = async () => { await fetch('/api/local/operator/session', { method: 'DELETE' }); setEvidence(null); await loadSession(); };

  const stateCards = evidence ? [
    ['Health', evidence.health],
    ['Events', evidence.events],
    ['Trace rationale', evidence.trace],
    ['Conflicts', evidence.conflicts],
    ['Policies', evidence.policies],
    ['Evaluations', evidence.evaluations],
    ['Replay results', evidence.replays],
  ] as const : [];

  return <div className="mx-auto max-w-6xl space-y-6" data-testid="operator-workspace">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Operator control plane</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Diagnose memory without reading logs</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Inspect redacted, server-sourced PostgreSQL evidence in a deliberately local operator session. The legacy <code>/sandbox/memory</code> page remains a separate browser-local deterministic study sandbox.</p>
    </div>

    {loading && <div role="status" className="rounded-xl border border-border-soft bg-surface p-4 text-sm text-muted">Loading local operator access…</div>}

    {!loading && !session?.authenticated && <section className="rounded-xl border border-accent-border bg-accent-soft/40 p-5" aria-labelledby="local-entry-heading">
      <div className="flex items-center gap-2"><KeyRound size={16} className="text-accent" aria-hidden="true" /><h2 id="local-entry-heading" className="text-sm font-semibold text-ink">Local development sign-in</h2></div>
      <p className="mt-2 text-sm leading-relaxed text-muted">Choose a server-approved seeded scope. The browser never supplies tenant, bank, project, or permissions as authority.</p>
      <div className="mt-4 flex flex-wrap gap-2">{(session?.availableScopes ?? []).map((scope) => <button key={scope.id} type="button" onClick={() => void enterScope(scope.id)} className="rounded-lg bg-[#2f2a44] px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Enter {scope.label} operator session</button>)}</div>
      <p role="status" className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Unauthorized</p>
    </section>}

    {!loading && session?.authenticated && <section data-testid="operator-evidence-dashboard" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Server-sourced durable evidence</p><h2 className="mt-1 text-lg font-semibold text-ink">{session?.label}</h2><p className="mt-1 text-xs text-muted">Project scope: {session?.projectId}</p></div><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-xs font-semibold text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><LogOut size={14} aria-hidden="true" />Sign out</button></div>
      {evidence ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stateCards.map(([label, item]) => <article key={label} className="rounded-xl border border-border-soft bg-surface p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{label}</h3><span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">{titleCase(item.state)}</span></div><p className="mt-3 text-2xl font-bold text-ink">{item.count ?? item.runs ?? item.completed ?? 0}</p><p className="mt-1 text-xs text-muted">{label === 'Trace rationale' ? `${item.gaps ?? 0} evidence gaps; ${item.rationales?.length ?? 0} rationale samples` : label === 'Evaluations' ? `${item.corrections ?? 0} corrections, ${item.comparisons ?? 0} comparisons` : label === 'Replay results' ? `${item.completed ?? 0} completed durable replays` : 'Redacted summary from the canonical store.'}</p></article>)}</div> : <div role="status" className="rounded-xl border border-border-soft bg-surface p-4 text-sm text-muted">Unavailable — the canonical store did not return a durable evidence summary.</div>}
      <div className="rounded-xl border border-border-soft bg-surface p-4"><div className="flex items-center gap-2"><Boxes size={15} className="text-accent" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Operator workspace sections</h2></div><nav aria-label="Operator workspace sections" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{sections.map(({ href, label, detail, icon: Icon }) => <Link key={label} href={href} className="group rounded-xl border border-border-soft bg-bg-soft p-4 transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={16} aria-hidden="true" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{detail}</span></span></div></Link>)}</nav></div>
    </section>}

    <section aria-labelledby="operator-state-heading" className="rounded-xl border border-border-soft bg-surface p-4"><div className="flex items-center gap-2"><Boxes size={15} className="text-accent" aria-hidden="true" /><h2 id="operator-state-heading" className="text-sm font-semibold text-ink">Operational states</h2></div><div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">{['Empty', 'Queued', 'Healthy', 'Degraded', 'Unavailable', 'Failed', 'Unauthorized'].map((state) => <span key={state} className="rounded-lg border border-border-soft bg-bg-soft px-3 py-2"><span className="font-semibold text-ink">{state}</span><span className="ml-1">is an explicit state, never an empty success.</span></span>)}</div></section>
  </div>;
}
