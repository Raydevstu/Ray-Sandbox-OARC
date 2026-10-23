"use client";

import { useEffect, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { advanceGallerySnapshot, createGallerySnapshot } from '@/lib/design-gallery';
import { CommandCenterTemplate } from './CommandCenterTemplate';
import { EvidenceTableTemplate } from './EvidenceTableTemplate';
import { MemoryTopologyTemplate } from './MemoryTopologyTemplate';

export function EnterpriseVisualGallery() {
  const [snapshot, setSnapshot] = useState(() => createGallerySnapshot(27));
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener('change', updateMotion);
    return () => media.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setSnapshot((current) => advanceGallerySnapshot(current)), 3_000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-10 pb-12">
      <header className="relative overflow-hidden rounded-3xl border border-border-soft bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_34%),radial-gradient(circle_at_10%_100%,color-mix(in_srgb,var(--observation)_16%,transparent),transparent_36%),var(--surface-1)] px-5 py-8 sm:px-8 sm:py-10">
        <div className="absolute right-[-7rem] top-[-9rem] h-72 w-72 rounded-full border border-accent-border/30" />
        <div className="relative max-w-3xl"><Badge color="var(--accent)">OARC VISUAL SYSTEM · LOCAL PREVIEW</Badge><h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">Enterprise visual gallery</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">A realistic comparison space for modern operational charts, dense evidence tables, and topology exploration—built to feel like a Tier-1 control plane rather than a static dashboard.</p><div className="mt-5 flex flex-wrap gap-2"><Badge color="var(--warn)">{snapshot.label}</Badge><Badge color={paused ? 'var(--warn)' : reducedMotion ? 'var(--experience)' : 'var(--ok)'}>{paused ? 'Stream paused' : reducedMotion ? 'Reduced motion' : 'Stream active'}</Badge></div></div>
      </header>

      <CommandCenterTemplate snapshot={snapshot} paused={paused} onTogglePaused={() => setPaused((current) => !current)} />
      <EvidenceTableTemplate rows={snapshot.evidenceRows} />
      <MemoryTopologyTemplate nodes={snapshot.topologyNodes} edges={snapshot.topologyEdges} />

      <Card className="border-accent-border/50 bg-accent-soft/30"><p className="text-sm font-medium text-ink">Preview boundary</p><p className="mt-1 text-sm leading-6 text-muted">All values in this gallery are deterministic synthetic samples. This page does not read, write, or represent PostgreSQL evidence, a connector feed, or production telemetry.</p></Card>
    </div>
  );
}
