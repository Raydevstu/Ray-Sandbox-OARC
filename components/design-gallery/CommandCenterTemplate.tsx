"use client";

import { Activity, Pause, Play, Radio, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, Segmented } from '@/components/ui';
import type { GallerySnapshot } from '@/lib/design-gallery';

type Range = '15m' | '1h' | '6h';

function LinePlot({ snapshot, range, enabled }: { snapshot: GallerySnapshot; range: Range; enabled: Record<'ingest' | 'recall' | 'policy', boolean> }) {
  const pointCount = range === '15m' ? 8 : range === '1h' ? 12 : 18;
  const points = snapshot.timeline.slice(-pointCount);
  const max = Math.max(...points.flatMap((point) => [point.ingest, point.recall, point.policy]), 1);
  const width = 820;
  const height = 248;
  const x = (index: number) => 36 + (index / Math.max(points.length - 1, 1)) * (width - 60);
  const y = (value: number) => 18 + (1 - value / max) * (height - 54);
  const series = [
    { id: 'ingest' as const, label: 'Ingest', color: '#36d399', values: points.map((point) => point.ingest) },
    { id: 'recall' as const, label: 'Recall', color: '#4fb6ea', values: points.map((point) => point.recall) },
    { id: 'policy' as const, label: 'Policy', color: '#a78bfa', values: points.map((point) => point.policy) },
  ];

  return (
    <div className="rounded-2xl border border-border-soft bg-[radial-gradient(circle_at_15%_0%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_38%),var(--surface-2)] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Synthetic throughput chart">
        {[0.2, 0.4, 0.6, 0.8].map((step) => <line key={step} x1="36" x2={width - 24} y1={y(max * step)} y2={y(max * step)} stroke="var(--border-soft)" strokeDasharray="3 5" />)}
        {series.filter((series) => enabled[series.id]).map((series) => (
          <g key={series.id}>
            <polyline points={series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {series.values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="4" fill={series.color}><title>{`${series.label}: ${value} synthetic operations`}</title></circle>)}
          </g>
        ))}
        <text x="36" y={height - 14} fill="var(--faint)" fontSize="11">{range} window</text>
        <text x={width - 24} y={height - 14} fill="var(--faint)" fontSize="11" textAnchor="end">now</text>
      </svg>
    </div>
  );
}

export function CommandCenterTemplate({ snapshot, paused, onTogglePaused }: { snapshot: GallerySnapshot; paused: boolean; onTogglePaused: () => void }) {
  const [range, setRange] = useState<Range>('1h');
  const [enabled, setEnabled] = useState<Record<'ingest' | 'recall' | 'policy', boolean>>({ ingest: true, recall: true, policy: true });
  const totals = useMemo(() => snapshot.timeline.slice(-8).reduce((total, point) => total + point.ingest + point.recall + point.policy, 0), [snapshot.timeline]);

  return (
    <section aria-labelledby="command-center-title" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge color="var(--accent)">TEMPLATE 01 · COMMAND CENTER</Badge>
          <h2 id="command-center-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Live operational intelligence</h2>
          <p className="mt-1 text-sm text-muted">Synthetic stream with real interaction controls. Updated sample {new Date(snapshot.lastUpdatedAt).toLocaleTimeString()}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={[{ value: '15m', label: '15m' }, { value: '1h', label: '1h' }, { value: '6h', label: '6h' }]} value={range} onChange={setRange} />
          <Button onClick={onTogglePaused} variant={paused ? 'primary' : 'outline'} aria-pressed={paused}>
            {paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume stream' : 'Pause stream'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['Events processed', totals.toLocaleString(), Activity, '#36d399'], ['Trace coverage', '98.7%', ShieldCheck, '#4fb6ea'], ['Policy drift', '2 signals', Radio, '#a78bfa']].map(([label, value, Icon, color]) => {
          const MetricIcon = Icon as typeof Activity;
          return <Card key={String(label)} className="overflow-hidden border-border-soft bg-[linear-gradient(135deg,var(--surface-1),var(--surface-2))]">
            <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[0.14em] text-faint">{String(label)}</p><MetricIcon size={16} style={{ color: String(color) }} /></div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{String(value)}</p>
            <div className="mt-3 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${String(color)}, transparent)` }} />
          </Card>;
        })}
      </div>

      <Card className="p-4 sm:p-5">
        <CardHeader title="Signal velocity" subtitle={paused ? 'Simulator paused — values are intentionally frozen.' : 'Bounded synthetic samples advance every three seconds.'} icon={<Activity size={16} />} right={<Badge color={paused ? 'var(--warn)' : 'var(--ok)'}>{paused ? '● paused' : '● streaming'}</Badge>} />
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Chart series">
          {(['ingest', 'recall', 'policy'] as const).map((key) => <button key={key} onClick={() => setEnabled((current) => ({ ...current, [key]: !current[key] }))} aria-pressed={enabled[key]} className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent-border aria-pressed:border-accent-border aria-pressed:bg-accent-soft aria-pressed:text-ink">{key}</button>)}
        </div>
        <LinePlot snapshot={snapshot} range={range} enabled={enabled} />
      </Card>
    </section>
  );
}
