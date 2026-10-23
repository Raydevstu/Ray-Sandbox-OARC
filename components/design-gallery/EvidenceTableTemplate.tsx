"use client";

import { ArrowDownUp, Filter, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Card, CardHeader, Input, Segmented } from '@/components/ui';
import { filterEvidenceRows, resolveSelectedEvidenceRow, sortEvidenceRows, type EvidenceRow, type SeverityFilter } from '@/lib/design-gallery';

const severityColor: Record<EvidenceRow['severity'], string> = { critical: 'var(--danger)', warning: 'var(--warn)', info: 'var(--observation)' };

export function EvidenceTableTemplate({ rows }: { rows: readonly EvidenceRow[] }) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [sort, setSort] = useState<'confidence' | 'updatedAt'>('updatedAt');
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const filtered = useMemo(() => sortEvidenceRows(filterEvidenceRows(rows, query, severity), sort), [query, rows, severity, sort]);
  const selected = resolveSelectedEvidenceRow(filtered, selectedId);

  return (
    <section aria-labelledby="evidence-table-title" className="space-y-4">
      <div><Badge color="var(--observation)">TEMPLATE 02 · EVIDENCE EXPLORER</Badge><h2 id="evidence-table-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Dense, inspectable evidence records</h2></div>
      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.8fr]">
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border-soft p-4"><CardHeader title="Evidence queue" subtitle="Interactive synthetic records with filtering, sorting, and inspectable rows." icon={<Filter size={16} />} />
            <div className="flex flex-col gap-2 md:flex-row"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-2.5 text-faint" /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search evidence" placeholder="Search evidence, source, or summary" className="pl-9" /></div><Segmented options={[{ value: 'all', label: 'All' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warnings' }, { value: 'info', label: 'Info' }]} value={severity} onChange={setSeverity} size="sm" /></div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-faint"><tr><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3"><button onClick={() => setSort((value) => value === 'confidence' ? 'updatedAt' : 'confidence')} className="inline-flex items-center gap-1 hover:text-ink">{sort === 'confidence' ? 'Confidence' : 'Updated'} <ArrowDownUp size={12} /></button></th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id} className="cursor-pointer border-t border-border-soft text-muted transition-colors hover:bg-accent-soft/50" onClick={() => setSelectedId(row.id)} aria-selected={selected?.id === row.id}><td className="px-4 py-3"><p className="font-medium text-ink">{row.title}</p><p className="mt-0.5 text-xs text-faint">{row.id}</p></td><td className="px-4 py-3 font-mono text-xs">{row.source}</td><td className="px-4 py-3"><Badge color={severityColor[row.severity]}>{row.severity}</Badge></td><td className="px-4 py-3 font-mono text-xs">{sort === 'confidence' ? `${Math.round(row.confidence * 100)}%` : new Date(row.updatedAt).toLocaleTimeString()}</td></tr>)}
          </tbody></table></div>
          {!filtered.length && <div className="p-10 text-center" role="status"><Sparkles className="mx-auto mb-3 text-faint" size={22} /><p className="font-medium text-ink">No matching evidence</p><p className="mt-1 text-sm text-muted">Adjust the synthetic preview filters to restore records.</p></div>}
        </Card>
        <Card className="bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--observation)_15%,transparent),transparent_45%),var(--surface-1)]"><CardHeader title="Inspection panel" subtitle="Selected row details" icon={<Search size={16} />} />
          {selected ? <div className="space-y-4" aria-live="polite"><Badge color={severityColor[selected.severity]}>{selected.severity} priority</Badge><div><p className="text-lg font-semibold text-ink">{selected.title}</p><p className="mt-2 text-sm leading-6 text-muted">{selected.summary}</p></div><div className="grid grid-cols-2 gap-2 border-t border-border-soft pt-4 text-xs"><div><p className="text-faint">Confidence</p><p className="mt-1 font-mono text-ink">{Math.round(selected.confidence * 100)}%</p></div><div><p className="text-faint">Source</p><p className="mt-1 font-mono text-ink">{selected.source}</p></div></div></div> : <div role="status" className="py-10 text-center text-sm text-muted">Choose a visible evidence row to inspect it.</div>}
        </Card>
      </div>
    </section>
  );
}
