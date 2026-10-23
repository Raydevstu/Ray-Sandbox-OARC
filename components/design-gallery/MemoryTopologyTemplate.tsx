"use client";

import { Focus, GitFork, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader } from '@/components/ui';
import { resolveTopologySelection, type TopologyEdge, type TopologyNode } from '@/lib/design-gallery';

const nodeColor: Record<TopologyNode['kind'], string> = { source: '#4fb6ea', memory: '#36d399', policy: '#a78bfa', conflict: '#f0b34c' };

export function MemoryTopologyTemplate({ nodes, edges }: { nodes: readonly TopologyNode[]; edges: readonly TopologyEdge[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const selected = resolveTopologySelection(nodes, selectedId);
  const indexed = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <section aria-labelledby="topology-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Badge color="var(--experience)">TEMPLATE 03 · MEMORY TOPOLOGY</Badge><h2 id="topology-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Evidence-linked memory topology</h2><p className="mt-1 text-sm text-muted">Interactive 2D graph with keyboard-equivalent node controls and a readable node summary.</p></div><Button variant="outline" onClick={() => setSelectedId(nodes[0]?.id ?? null)}><RotateCcw size={14} /> Reset focus</Button></div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.75fr]">
        <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border-soft px-4 py-3"><span className="text-sm font-medium text-ink">Topology canvas</span><Badge color="var(--experience)"><GitFork size={11} /> {nodes.length} nodes</Badge></div>
          <div className="relative min-h-[340px] overflow-hidden bg-[radial-gradient(circle_at_50%_15%,color-mix(in_srgb,var(--experience)_18%,transparent),transparent_35%),linear-gradient(135deg,var(--surface-2),var(--surface-1))] p-4">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
              {edges.map((edge) => { const from = indexed.get(edge.from); const to = indexed.get(edge.to); if (!from || !to) return null; const active = selectedId === edge.from || selectedId === edge.to; return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={active ? 'var(--accent)' : 'var(--border)'} strokeWidth={active ? '0.75' : '0.4'} strokeDasharray={active ? undefined : '1.4 1.4'} />; })}
            </svg>
            {nodes.map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} aria-pressed={selectedId === node.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left shadow-lg transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ left: `${node.x}%`, top: `${node.y}%`, borderColor: selectedId === node.id ? nodeColor[node.kind] : 'var(--border)', background: selectedId === node.id ? `color-mix(in srgb, ${nodeColor[node.kind]} 20%, var(--surface))` : 'var(--surface)' }}><span className="block text-[10px] uppercase tracking-wider" style={{ color: nodeColor[node.kind] }}>{node.kind}</span><span className="mt-0.5 block text-xs font-medium text-ink">{node.label}</span></button>)}
          </div>
        </Card>
        <Card className="bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--experience)_14%,transparent),transparent_40%),var(--surface-1)]"><CardHeader title="Node focus" subtitle="Accessible detail alternative" icon={<Focus size={16} />} />
          {selected ? <div className="space-y-4" role="status"><div className="inline-flex rounded-lg border px-2 py-1 text-xs capitalize" style={{ color: nodeColor[selected.kind], borderColor: nodeColor[selected.kind] }}>{selected.kind}</div><div><p className="text-lg font-semibold text-ink">{selected.label}</p><p className="mt-2 text-sm leading-6 text-muted">{selected.summary}</p></div><div className="border-t border-border-soft pt-4"><p className="mb-2 text-xs uppercase tracking-wider text-faint">Keyboard selection</p><div className="flex flex-wrap gap-2">{nodes.map((node) => <button key={node.id} onClick={() => setSelectedId(node.id)} className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-accent-border hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{node.label}</button>)}</div></div></div> : <p className="text-sm text-muted">Select a node to inspect its synthetic explanation.</p>}
        </Card>
      </div>
    </section>
  );
}
