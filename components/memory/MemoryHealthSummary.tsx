import { Activity, CheckCircle2, Clock3, Database, TriangleAlert, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui';
import { deriveMemoryHealth, type MemoryHealthStatus } from '@/lib/runtime/memory-health';

const icons: Record<MemoryHealthStatus, typeof Activity> = { empty: Database, queued: Clock3, healthy: CheckCircle2, degraded: TriangleAlert, unavailable: XCircle, failed: XCircle };
const colors: Record<MemoryHealthStatus, string> = { empty: 'var(--faint)', queued: 'var(--warn)', healthy: 'var(--ok)', degraded: 'var(--warn)', unavailable: 'var(--danger)', failed: 'var(--danger)' };

export function MemoryHealthSummary({ records, pending = 0, failures = 0, store = 'healthy' }: Readonly<{ records: number; pending?: number; failures?: number; store?: 'healthy' | 'unavailable' | 'failed' }>) {
  const health = deriveMemoryHealth({ records, pending, failures, store });
  const Icon = icons[health.status];
  return <Card aria-label="Memory health summary"><CardHeader title="Memory health" subtitle="A simple view of your durable memory" icon={<Icon size={15} color={colors[health.status]} />} /><div className="flex items-start gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: colors[health.status] }} aria-hidden="true" /><div><p className="text-sm font-semibold text-ink">{health.label}</p><p className="text-xs text-muted mt-1">{health.detail}</p></div></div></Card>;
}
