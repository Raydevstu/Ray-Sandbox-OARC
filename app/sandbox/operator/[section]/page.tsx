import Link from 'next/link';
import { ArrowLeft, CircleAlert, Download, ListChecks, ShieldCheck } from 'lucide-react';

const sections = {
  conflicts: { title: 'Conflicts', description: 'Reviewable uncertainty and correction decisions.', icon: CircleAlert },
  policies: { title: 'Policies', description: 'Versioned approval, retention, and explainability rules.', icon: ShieldCheck },
  events: { title: 'Events', description: 'Durable event-ledger records and replay history.', icon: ListChecks },
  exports: { title: 'Exports', description: 'Auditable manifests and report downloads.', icon: Download },
} as const;

export default async function OperatorSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = sections[section as keyof typeof sections];
  if (!item) return <div className="mx-auto max-w-3xl rounded-xl border border-border-soft bg-surface p-6"><h1 className="text-lg font-semibold text-ink">Operator section unavailable</h1><p className="mt-2 text-sm text-muted">This workspace section does not exist.</p></div>;
  const Icon = item.icon;
  return <div className="mx-auto max-w-3xl space-y-4"><Link href="/sandbox/operator" className="inline-flex items-center gap-2 text-xs text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowLeft size={14} aria-hidden="true" />Back to operator workspace</Link><section className="rounded-xl border border-border-soft bg-surface p-6" aria-labelledby="operator-section-heading"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} aria-hidden="true" /></span><div><h1 id="operator-section-heading" className="text-xl font-bold text-ink">{item.title}</h1><p className="mt-1 text-sm text-muted">{item.description}</p></div></div><div className="mt-6 rounded-lg border border-border-soft bg-bg-soft p-4 text-sm text-muted" role="status"><strong className="text-ink">Queued for connected runtime</strong><p className="mt-1">This operator surface is available as an explicit workspace state while its authenticated data source is unavailable.</p></div></section></div>;
}
